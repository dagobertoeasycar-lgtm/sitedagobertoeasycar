import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_INITIAL_PASSWORD;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL não configurada");
if (!email || !email.includes("@")) throw new Error("ADMIN_EMAIL inválido");
if (!password || password.length < 14) throw new Error("ADMIN_INITIAL_PASSWORD precisa ter ao menos 14 caracteres");

const salt = randomBytes(24).toString("hex");
const passwordHash = scryptSync(password, salt, 64).toString("hex");
const client = new pg.Client({ connectionString, application_name: "dagoberto_create_admin" });
await client.connect();

try {
  const existing = await client.query("select id from users where email = $1", [email]);
  if (existing.rowCount) throw new Error("Administrador já existe; nenhuma senha foi alterada");
  await client.query(
    "insert into users(email, password_hash, password_salt, role, must_change_password) values ($1, $2, $3, 'admin', true)",
    [email, passwordHash, salt],
  );
  console.log("Administrador inicial criado. Remova ADMIN_INITIAL_PASSWORD do ambiente e troque a senha no primeiro acesso.");
} finally {
  await client.end();
}
