import { randomBytes, scryptSync } from "node:crypto";
import readline from "node:readline";
import pg from "pg";

// Redefine a senha de um usuário do painel. Pede o e-mail e a nova senha no
// terminal (a senha não aparece enquanto é digitada) e nunca a grava em
// arquivo ou log. Uso: node --env-file=.env.local scripts/reset-admin-password.mjs

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não configurada");

function perguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(s); };
    rl.question(texto, (resposta) => { rl.close(); if (oculto) process.stdout.write("\n"); resolve(resposta); });
  });
}

const client = new pg.Client({ connectionString, application_name: "dagoberto_reset_admin" });
await client.connect();

try {
  const usuarios = await client.query("select email, role, active from users order by created_at");
  console.log("Usuários cadastrados:");
  for (const u of usuarios.rows) console.log(`  - ${u.email} (${u.role}${u.active ? "" : ", inativo"})`);

  const email = (await perguntar("E-mail do usuário: ")).trim().toLowerCase();
  if (!usuarios.rows.some((u) => u.email === email)) throw new Error("E-mail não encontrado");

  const senha = await perguntar("Nova senha (mín. 14 caracteres): ", true);
  if (senha.length < 14) throw new Error("A senha precisa ter ao menos 14 caracteres");
  if ((await perguntar("Repita a senha: ", true)) !== senha) throw new Error("As senhas não conferem");

  const salt = randomBytes(24).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  await client.query(
    "update users set password_hash = $1, password_salt = $2, active = true, updated_at = now() where email = $3",
    [hash, salt, email],
  );
  console.log(`Senha de ${email} redefinida.`);
} finally {
  await client.end();
}
