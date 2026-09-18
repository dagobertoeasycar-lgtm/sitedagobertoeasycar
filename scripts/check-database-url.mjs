/**
 * Valida o formato da DATABASE_URL e explica o problema em português.
 *
 * Motivo: quando a variável está malformada, o `pg` falha com uma mensagem
 * crua e enganosa — por exemplo `getaddrinfo EAI_AGAIN base`, que parece
 * problema de rede mas na verdade é o host da URL vindo errado. Isso deixou
 * a sincronização do GitHub Actions quebrada por dias sem ninguém entender.
 *
 * Uso: import { validarDatabaseUrl } from "./check-database-url.mjs"
 *      node scripts/check-database-url.mjs   (checagem isolada)
 */

/** Hosts que indicam que alguém colou um exemplo em vez do endereço real. */
const HOSTS_SUSPEITOS = ["base", "host", "servidor", "localhost", "seu-host", "exemplo", "example", "dados"];

export function validarDatabaseUrl(valor = process.env.DATABASE_URL) {
  const bruto = String(valor ?? "");

  if (!bruto.trim()) {
    return {
      ok: false,
      motivo:
        "DATABASE_URL não está definida.\n" +
        "  No GitHub: Settings → Secrets and variables → Actions → DATABASE_URL.\n" +
        "  Na Vercel: Settings → Environment Variables.",
    };
  }

  // Colar "DATABASE_URL=postgres://..." dentro do próprio segredo é comum.
  if (/^\s*DATABASE_URL\s*=/i.test(bruto)) {
    return {
      ok: false,
      motivo:
        'A variável contém o próprio nome dela ("DATABASE_URL=..."). ' +
        "Guarde só o endereço, começando em postgres:// ou postgresql://",
    };
  }

  if (bruto !== bruto.trim() || /[\r\n]/.test(bruto)) {
    return {
      ok: false,
      motivo: "A variável tem espaço ou quebra de linha nas pontas. Cole o endereço em uma única linha, sem aspas.",
    };
  }

  // Valor embrulhado. Os sinais < > vêm dos exemplos de documentação, onde
  // significam "troque por seu valor"; as aspas vêm do botão de copiar da
  // Vercel. Em qualquer dos casos o `new URL()` abaixo falha com uma mensagem
  // genérica que não diz o que está errado, então nomeamos os sinais aqui.
  const EMBRULHOS = [
    ["<", ">", "sinais de menor e maior (< >)"],
    ['"', '"', "aspas duplas"],
    ["'", "'", "aspas simples"],
    ["`", "`", "acentos graves (`)"],
  ];
  for (const [abre, fecha, nome] of EMBRULHOS) {
    const soAbre = bruto.startsWith(abre);
    const soFecha = bruto.endsWith(fecha);
    if (soAbre || soFecha) {
      const limpo = bruto.replace(/^[<"'`]+/, "").replace(/[>"'`]+$/, "");
      return {
        ok: false,
        motivo:
          `O endereço está entre ${nome}. Remova ${soAbre && soFecha ? "os dois" : "esse sinal"} e guarde só o endereço.\n` +
          `  Errado:  DATABASE_URL=${abre}postgresql://...${fecha}\n` +
          "  Certo:   DATABASE_URL=postgresql://..." +
          (limpo.startsWith("postgres") ? "\n  O resto do valor está correto — é só tirar os sinais das pontas." : ""),
      };
    }
  }

  let url;
  try {
    url = new URL(bruto);
  } catch {
    // Chegar aqui quase sempre quer dizer que a porta virou texto, e a porta
    // vira texto quando o PowerShell expandiu um $ da senha dentro de aspas
    // DUPLAS e comeu um pedaço do endereço.
    return {
      ok: false,
      motivo:
        "A variável não é um endereço válido.\n" +
        "  Formato esperado: postgresql://usuario:senha@servidor:5432/nome_do_banco\n" +
        "  Se a senha tem $, use aspas SIMPLES no PowerShell — entre aspas duplas\n" +
        "  ele troca $alguma-coisa por vazio e estraga o endereço:\n" +
        "    $env:DATABASE_URL='postgresql://usuario:senha@servidor:5432/banco'",
    };
  }

  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    return { ok: false, motivo: `Protocolo "${url.protocol}" não serve. Use postgres:// ou postgresql://` };
  }

  if (!url.hostname) {
    return {
      ok: false,
      motivo:
        "O endereço está sem servidor. Provável @ faltando ou fora de lugar.\n" +
        "  Formato esperado: postgresql://usuario:senha@servidor:5432/nome_do_banco",
    };
  }

  if (HOSTS_SUSPEITOS.includes(url.hostname.toLowerCase())) {
    return {
      ok: false,
      motivo:
        `O servidor está como "${url.hostname}", que parece texto de exemplo e não um endereço real.\n` +
        "  Foi exatamente isso que derrubou a sincronização: o Node tenta resolver esse nome no DNS e falha\n" +
        "  com EAI_AGAIN. Copie o mesmo valor que já funciona nas variáveis da Vercel.",
    };
  }

  const banco = url.pathname.replace(/^\//, "");
  if (!banco) {
    return { ok: false, motivo: "O endereço está sem o nome do banco depois da barra final." };
  }

  // Só o que é seguro mostrar em log público: nunca usuário, senha ou host completo.
  return {
    ok: true,
    resumo: `host ${url.hostname.replace(/^([^.]{0,3})[^.]*/, "$1***")} · banco ${banco} · ssl ${url.searchParams.get("sslmode") ?? "padrão"}`,
  };
}

/** Aborta com mensagem clara. Para usar no início dos scripts de banco. */
export function exigirDatabaseUrl() {
  const r = validarDatabaseUrl();
  if (!r.ok) {
    console.error(`\nDATABASE_URL inválida.\n  ${r.motivo}\n`);
    process.exit(1);
  }
  return r;
}

const executadoDireto =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/check-database-url.mjs");

if (executadoDireto) {
  const r = validarDatabaseUrl();
  if (r.ok) console.log(`DATABASE_URL ok — ${r.resumo}`);
  else {
    console.error(`DATABASE_URL inválida.\n  ${r.motivo}`);
    process.exit(1);
  }
}
