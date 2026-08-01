import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const environmentFile = path.join(root, ".env.production");
const lines = (await readFile(environmentFile, "utf8")).replace(/^\uFEFF/, "").split(/\r?\n/);

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator <= 0) continue;
  process.env[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");

await import("./migrate.mjs");
