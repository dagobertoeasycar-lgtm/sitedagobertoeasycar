import pg from "pg";

const sourceUrl = process.env.JSON_SOURCE_URL;
const token = process.env.JSON_AUTH_TOKEN;
const connectionString = process.env.DATABASE_URL;
if (!sourceUrl || !connectionString) throw new Error("JSON_SOURCE_URL e DATABASE_URL são obrigatórias");

const client = new pg.Client({ connectionString, application_name: "dagoberto_json_sync" });
await client.connect();
const lock = await client.query("select pg_try_advisory_lock(hashtext('dagoberto_json_sync')) as locked");
if (!lock.rows[0]?.locked) {
  console.log("Sincronização anterior ainda ativa; execução ignorada.");
  await client.end();
  process.exit(0);
}

const run = await client.query("insert into sync_runs(source_id) values ('json') returning id");
const runId = run.rows[0].id;
let processed = 0;
let created = 0;
let updated = 0;
let errors = 0;

try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const response = await fetch(sourceUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal,
  });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(`Fonte JSON respondeu ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("A fonte JSON deve retornar uma lista de veículos");

  for (const item of payload) {
    processed += 1;
    try {
      const externalId = String(item.externalId ?? item.id ?? "").trim();
      if (!externalId || !item.title || !item.slug) throw new Error("Registro sem externalId, title ou slug");
      const result = await client.query(
        `insert into vehicles(source_id, external_id, slug, title, brand, model, version, year_make, year_model, price_cents, mileage, fuel, transmission, body_type, city, description, image_url, status)
         values ('json', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'published')
         on conflict (source_id, external_id) do update set slug=excluded.slug, title=excluded.title, brand=excluded.brand, model=excluded.model, version=excluded.version, year_make=excluded.year_make, year_model=excluded.year_model, price_cents=excluded.price_cents, mileage=excluded.mileage, fuel=excluded.fuel, transmission=excluded.transmission, body_type=excluded.body_type, city=excluded.city, description=excluded.description, image_url=excluded.image_url, updated_at=now()
         returning (xmax = 0) as inserted`,
        [externalId, item.slug, item.title, item.brand ?? "", item.model ?? "", item.version ?? "", Number(item.yearMake), Number(item.yearModel), Math.round(Number(item.price) * 100), Number(item.mileage ?? 0), item.fuel ?? "", item.transmission ?? "", item.bodyType ?? "", item.city ?? "Osasco/SP", item.description ?? "", item.imageUrl ?? null],
      );
      if (result.rows[0].inserted) created += 1;
      else updated += 1;
    } catch (error) {
      errors += 1;
      console.error(`Falha no item ${processed}:`, error instanceof Error ? error.message : "erro desconhecido");
    }
  }
} finally {
  await client.query("update sync_runs set finished_at=now(), processed=$2, created=$3, updated=$4, errors=$5 where id=$1", [runId, processed, created, updated, errors]).catch(() => undefined);
  await client.query("select pg_advisory_unlock(hashtext('dagoberto_json_sync'))").catch(() => undefined);
  await client.end();
}

console.log(JSON.stringify({ processed, created, updated, errors }));
