import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL não configurada");

const client = new pg.Client({ connectionString, application_name: "dagoberto_migrate" });
await client.connect();

try {
  await client.query("select pg_advisory_lock(hashtext('dagoberto_easycar_migrations'))");
  await client.query("create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())");
  const directory = path.join(process.cwd(), "migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const exists = await client.query("select 1 from schema_migrations where version = $1", [file]);
    if (exists.rowCount) continue;
    const sql = await readFile(path.join(directory, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations(version) values ($1)", [file]);
      await client.query("commit");
      console.log(`Migration aplicada: ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  await client.query("select pg_advisory_unlock(hashtext('dagoberto_easycar_migrations'))").catch(() => undefined);
  await client.end();
}
