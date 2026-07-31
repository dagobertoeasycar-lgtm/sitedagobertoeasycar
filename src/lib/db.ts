import { Pool, type QueryResultRow } from "pg";

declare global {
  var dagobertoPool: Pool | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada");
  if (!globalThis.dagobertoPool) {
    globalThis.dagobertoPool = new Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "dagoberto_easycar",
    });
  }
  return globalThis.dagobertoPool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function databaseStatus() {
  const started = Date.now();
  await query("select 1");
  return { ok: true, latencyMs: Date.now() - started };
}
