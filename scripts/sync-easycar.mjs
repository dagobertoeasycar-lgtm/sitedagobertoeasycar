/**
 * sync-easycar.mjs
 * Sincroniza o estoque da EasyCar (easycarveiculos.com.br) com o banco da
 * Autodrive usando a API pública de estoque do site de origem.
 *
 * Substitui a raspagem de HTML anterior: o site da EasyCar passou a renderizar
 * a listagem no cliente, então o HTML servido não contém mais os veículos.
 * A API /api/stock devolve os mesmos dados em JSON, de forma estável e rápida.
 *
 * Uso: node scripts/sync-easycar.mjs
 * Variáveis: DATABASE_URL (obrigatória)
 *            EASYCAR_REVENDAS (opcional, ids separados por vírgula p/ filtrar lojas)
 */
import pg from "pg";

const BASE = process.env.EASYCAR_BASE_URL || "https://easycarveiculos.com.br";
const PER_PAGE = 100;
const SOURCE_ID = "easycar_scraper";
const CITY = "Osasco/SP";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória");

const revendaFilter = (process.env.EASYCAR_REVENDAS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toCents(value) {
  const n = Number.parseFloat(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function toInt(value) {
  const n = Number.parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Protege as colunas integer do banco contra valores absurdos da origem. */
function clamp(value, max) {
  const n = toInt(value);
  return n > max ? max : n;
}

async function fetchStockPage(page) {
  const url = `${BASE}/api/stock?pagina=${page}&registros_por_pagina=${PER_PAGE}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Converte um item da API de origem no formato das colunas da tabela vehicles. */
function mapVehicle(v) {
  const brand = cleanText(v.marca_apelido || v.marca_nome);
  const model = cleanText(v.modelopai_nome || v.modelo_nome);
  const version = cleanText(v.versao_descricao || v.modelo_nome);
  const title = [brand, model].filter(Boolean).join(" ") || cleanText(v.modelo_nome);

  const yearMake = toInt(v.anofabricacao) || toInt(v.anomodelo);
  const yearModel = toInt(v.anomodelo) || yearMake;

  const MAX_CENTS = 2000000000; // ~R$ 20.000.000,00 — teto do integer do banco
  const sale = Math.min(toCents(v.valorvenda), MAX_CENTS);
  const promo = Math.min(toCents(v.valorpromocao), MAX_CENTS);
  const hasPromo = promo > 0 && promo < sale;
  const priceCents = hasPromo ? promo : sale;
  const oldPriceCents = hasPromo ? sale : null;

  const photos = Array.isArray(v.fotos) ? v.fotos : [];
  const media = photos
    .map((f) => (typeof f === "string" ? f : f?.url || f?.photo_url))
    .filter(Boolean)
    .map((url) => ({ type: "image", url }));
  if (!media.length && v.foto) media.push({ type: "image", url: v.foto });

  const options = (Array.isArray(v.acessorios) ? v.acessorios : [])
    .map((a) => cleanText(a?.nome))
    .filter(Boolean);

  const descriptionParts = [
    version,
    v.cor_nome ? `Cor ${cleanText(v.cor_nome)}` : "",
    v.cambio_nome ? `Câmbio ${cleanText(v.cambio_nome)}` : "",
    v.combustivel_nome ? cleanText(v.combustivel_nome) : "",
    Number(v.pericia) ? "Veículo periciado" : "",
  ].filter(Boolean);

  return {
    externalId: String(v.id),
    slug: slugify(`${title} ${version} ${yearModel} ${v.id}`),
    title,
    brand,
    model,
    version,
    yearMake,
    yearModel,
    priceCents,
    oldPriceCents,
    promotion: hasPromo,
    // Quilometragem digitada errada na origem (ex.: 3333333333) estourava o integer.
    mileage: clamp(v.km, 2000000),
    fuel: cleanText(v.combustivel_nome),
    transmission: cleanText(v.cambio_nome),
    bodyType: cleanText(v.carroceria_nome),
    color: cleanText(v.cor_nome),
    doors: toInt(v.portas) || 4,
    description: descriptionParts.join(" · ").slice(0, 5000),
    imageUrl: v.foto || media[0]?.url || null,
    media,
    options,
    store: cleanText(v.revenda_nome),
    revendaId: v.revenda_id != null ? String(v.revenda_id) : "",
    originType: "PARTNER",
  };
}

async function upsertPartner(client, vehicle, cache) {
  const name = cleanText(vehicle.store) || "Parceiro Autodrive";
  const externalId = vehicle.revendaId || (vehicle.store ? `store:${slugify(vehicle.store)}` : "");
  if (!externalId) return null;
  const cacheKey = `${SOURCE_ID}:${externalId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const result = await client.query(
    `insert into partners(source_id, external_id, name, city, notes, active, updated_at)
     values($1,$2,$3,$4,$5,true,now())
     on conflict (source_id, external_id) do update set
       name=excluded.name,
       city=excluded.city,
       active=true,
       updated_at=now()
     returning id`,
    [
      SOURCE_ID,
      externalId,
      name,
      CITY.split("/")[0],
      "Parceiro sincronizado automaticamente pela API da EasyCar.",
    ],
  );
  const partnerId = result.rows[0]?.id ?? null;
  cache.set(cacheKey, partnerId);
  return partnerId;
}

async function collectVehicles() {
  const first = await fetchStockPage(1);
  const total = Number(first.total) || (first.data || []).length;
  const totalPages = Number(first.total_paginas) || Math.ceil(total / PER_PAGE) || 1;
  console.log(`Estoque de origem: ${total} veículos em ${totalPages} página(s).`);

  const raw = [...(first.data || [])];
  for (let page = 2; page <= totalPages; page++) {
    await sleep(400);
    const body = await fetchStockPage(page);
    raw.push(...(body.data || []));
    console.log(`  página ${page}/${totalPages}: ${(body.data || []).length} itens`);
  }

  const seen = new Set();
  const vehicles = [];
  for (const item of raw) {
    if (!item || item.id == null) continue;
    const id = String(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const mapped = mapVehicle(item);
    if (revendaFilter.length && !revendaFilter.includes(mapped.revendaId)) continue;
    if (!mapped.title || !mapped.priceCents) {
      console.warn(`  ignorado ${id}: sem título ou sem preço`);
      continue;
    }
    // Todo veículo do estoque de origem é publicado, inclusive os que ainda
    // estão em preparação ou aguardando fotos — o site mostra o cartão com
    // "Imagem em breve" até a loja subir as imagens.
    mapped.status = "published";
    vehicles.push(mapped);
  }
  return vehicles;
}

// ── Execução ──────────────────────────────────────────────────────────
/**
 * Executa uma sincronização completa. Pode ser chamada pelo painel
 * administrativo (import) ou pela linha de comando.
 */
export async function runSync() {
  const client = new pg.Client({
    connectionString,
    application_name: "dagoberto_easycar_sync",
  });
  await client.connect();

  const lock = await client.query(
    "select pg_try_advisory_lock(hashtext('easycar_sync')) as locked"
  );
  if (!lock.rows[0]?.locked) {
    console.log("Sincronização anterior ainda ativa; ignorando.");
    await client.end();
    return { skippedRun: true, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  const configResult = await client
    .query("select value from sync_config where key='easycar_enabled'")
    .catch(() => ({ rows: [] }));
  if (configResult.rows[0]?.value === "false") {
    console.log("Sync desabilitada no painel.");
    await client.query("select pg_advisory_unlock(hashtext('easycar_sync'))").catch(() => {});
    await client.end();
    return { disabled: true, processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }

  const run = await client.query(
    "insert into sync_runs(source_id) values ($1) returning id",
    [SOURCE_ID]
  );
  const runId = run.rows[0].id;
  let processed = 0,
    created = 0,
    updated = 0,
    skipped = 0,
    errors = 0;

  try {
    const vehicles = await collectVehicles();
    console.log(`Veículos válidos para importar: ${vehicles.length}`);
    const partnerCache = new Map();

    for (const vehicle of vehicles) {
      processed++;
      try {
        const partnerId = await upsertPartner(client, vehicle, partnerCache);
        const result = await client.query(
          `insert into vehicles(
            source_id, external_id, slug, title, brand, model, version,
            year_make, year_model, price_cents, old_price_cents, mileage,
            fuel, transmission, body_type, city, color, doors,
            description, image_url, images, options, store, origin_type, partner_id, partner_external_id,
            status, stock_status, featured, promotion
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,
            $27, 'available', false, $28
          )
          on conflict (source_id, external_id) do update set
            slug=excluded.slug, title=excluded.title, brand=excluded.brand, model=excluded.model,
            version=excluded.version, year_make=excluded.year_make, year_model=excluded.year_model,
            price_cents=excluded.price_cents, old_price_cents=excluded.old_price_cents,
            mileage=excluded.mileage, fuel=excluded.fuel, transmission=excluded.transmission,
            body_type=excluded.body_type, color=excluded.color, doors=excluded.doors,
            description=excluded.description, image_url=excluded.image_url, images=excluded.images,
            options=excluded.options, store=excluded.store, origin_type=excluded.origin_type,
            partner_id=excluded.partner_id, partner_external_id=excluded.partner_external_id,
            promotion=excluded.promotion,
            status=excluded.status, stock_status='available', updated_at=now()
          returning (xmax = 0) as inserted`,
          [
            SOURCE_ID,
            vehicle.externalId,
            vehicle.slug,
            vehicle.title,
            vehicle.brand,
            vehicle.model,
            vehicle.version,
            vehicle.yearMake,
            vehicle.yearModel,
            vehicle.priceCents,
            vehicle.oldPriceCents,
            vehicle.mileage,
            vehicle.fuel,
            vehicle.transmission,
            vehicle.bodyType,
            CITY,
            vehicle.color,
            vehicle.doors,
            vehicle.description,
            vehicle.imageUrl,
            JSON.stringify(vehicle.media),
            JSON.stringify(vehicle.options),
            vehicle.store,
            vehicle.originType,
            partnerId,
            vehicle.revendaId || "",
            vehicle.status,
            vehicle.promotion,
          ]
        );
        if (result.rows[0].inserted) created++;
        else updated++;
      } catch (e) {
        errors++;
        console.error(`Erro no veículo ${vehicle.externalId}:`, e.message);
      }
    }

    // Veículos que saíram do estoque de origem deixam de ser publicados.
    if (vehicles.length > 10) {
      const activeIds = vehicles.map((v) => v.externalId);
      const removed = await client.query(
        `update vehicles set status='paused', stock_status='sold', updated_at=now()
          where source_id=$1 and external_id is not null
            and external_id != all($2::text[])
            and status in ('published','draft')`,
        [SOURCE_ID, activeIds]
      );
      skipped = removed.rowCount || 0;
      if (skipped > 0) console.log(`${skipped} veículo(s) fora do estoque foram pausados.`);
    }
  } catch (e) {
    errors++;
    console.error("Erro geral:", e.message);
  } finally {
    await client
      .query(
        "update sync_runs set finished_at=now(), processed=$2, created=$3, updated=$4, skipped=$5, errors=$6 where id=$1",
        [runId, processed, created, updated, skipped, errors]
      )
      .catch(() => {});
    await client.query("select pg_advisory_unlock(hashtext('easycar_sync'))").catch(() => {});
    await client.end();
  }

  const summary = { processed, created, updated, skipped, errors };
  console.log(JSON.stringify(summary));
  return summary;
}

// Execução direta pela linha de comando (build, GitHub Actions, terminal).
const isCli =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("scripts/sync-easycar.mjs");

if (isCli) {
  await runSync();
}
