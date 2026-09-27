/**
 * Conexão com o banco que se recupera sozinha.
 *
 * O sync passa minutos sem falar com o banco enquanto lê sites lentos (Now
 * Car/Justo Car via leitores públicos). Nesse intervalo o Neon encerra a
 * conexão ociosa ("terminating connection due to administrator command",
 * código 57P01). Com um pg.Client comum isso vira um evento 'error' sem
 * tratamento e derruba o processo inteiro — foi o que falhou em 27/09/2026.
 *
 * Aqui a queda só é registrada; a próxima consulta abre outra conexão e
 * repete (até 3 tentativas). Só erros de conexão são repetidos — erro de SQL
 * sobe normalmente. Não há transações abertas entre consultas no sync e a
 * trava é por tempo (lease.mjs), então reconectar é seguro.
 */
import pg from "pg";

const CODIGOS_DE_CONEXAO = new Set([
  "57P01", "57P02", "57P03", // encerrada pelo servidor / banco reiniciando
  "08000", "08001", "08003", "08004", "08006", // falhas de conexão
  "ECONNRESET", "ECONNREFUSED", "EPIPE", "ETIMEDOUT", "EAI_AGAIN",
]);

export function erroDeConexao(e) {
  if (!e) return false;
  if (CODIGOS_DE_CONEXAO.has(e.code)) return true;
  return /Connection terminated|connection error|not queryable|Client was closed|terminating connection/i.test(String(e.message ?? ""));
}

export function criarConexao({ connectionString, application_name, log = console.log, tentativas = 3 }) {
  let atual = null;

  async function conectar() {
    const c = new pg.Client({ connectionString, application_name, keepAlive: true });
    c.on("error", (e) => {
      log(`  (conexão com o banco caiu: ${e.code ?? e.message}; reconecta na próxima consulta)`);
      if (atual === c) atual = null;
    });
    await c.connect();
    atual = c;
    return c;
  }

  return {
    async connect() {
      if (!atual) await conectar();
    },
    async query(text, params) {
      for (let t = 1; ; t++) {
        let c;
        try {
          c = atual ?? (await conectar());
          return await c.query(text, params);
        } catch (e) {
          if (t >= tentativas || !erroDeConexao(e)) throw e;
          if (c && atual === c) atual = null;
          c?.end().catch(() => undefined);
          log(`  (banco indisponível: ${e.code ?? e.message}; tentando de novo ${t}/${tentativas - 1})`);
          await new Promise((r) => setTimeout(r, 1500 * t));
        }
      }
    },
    async end() {
      const c = atual;
      atual = null;
      if (c) await c.end().catch(() => undefined);
    },
  };
}
