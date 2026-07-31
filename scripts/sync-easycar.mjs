/**
 * sync-easycar.mjs
 * Scraper que puxa o estoque completo de easycarveiculos.com.br
 * e faz upsert no banco do Dagoberto EasyCar.
 *
 * Uso: node scripts/sync-easycar.mjs
 * Variáveis: DATABASE_URL (obrigatória)
 */
import pg from "pg";

const BASE = "https://easycarveiculos.com.br";
const PER_PAGE = 18;
const SOURCE_ID = "easycar_scraper";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória");

// ── helpers ──────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "DagobertoEasycar-Sync/1.0" },
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status} para ${url}`);
    return await res.text();
  } catch (e) { clearTimeout(t); throw e; }
}

function extractText(html, regex, group = 1) {
  const m = html.match(regex);
  return m ? m[group].trim() : "";
}

function extractAll(html, regex) {
  const results = [];
  let m;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = re.exec(html)) !== null) results.push(m[1].trim());
  return results;
}

function decodeHtml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function slugify(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);
}

function parsePriceBRL(text) {
  // "69.980" or "R$ 69.980" -> 6998000 centavos
  const clean = text.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const val = parseFloat(clean);
  return Number.isFinite(val) ? Math.round(val * 100) : 0;
}

// ── Parse listing page ────────────────────────────────────────────────
function parseListingPage(html) {
  const vehicles = [];
  // Each vehicle card is an <a> with href containing /carros/
  // Pattern: the card blocks between vehicle links
  const cardRegex = /<a[^>]+href="(\/carros\/[^"]+)"[^>]*>[\s\S]*?<\/a>\s*(?:<a[^>]+href="\/carros|$)/g;

  // Simpler approach: find all vehicle links and extract data from surrounding HTML
  // Split by vehicle card boundaries
  const cardBlocks = html.split(/(?=<a[^>]*href="\/carros\/)/g).filter(b => b.includes("/carros/"));

  for (const block of cardBlocks) {
    try {
      // URL and external ID
      const urlMatch = block.match(/href="(\/carros\/([^/]+)\/([^/]+)\/(\d+)\/(\d+))"/);
      if (!urlMatch) continue;
      const [, path, brandSlug, modelSlug, year, externalId] = urlMatch;

      // Already seen this ID in this page? skip duplicate links
      if (vehicles.find(v => v.externalId === externalId)) continue;

      // Brand name from alt or title
      const brandName = extractText(block, /title="([^"]+?)(?:\s+(?:ONIX|Fit|CITY|TAOS|Strada|KICKS|HB20|ARRIZO|PULSE|SPIN|T-Cross|XC|DUSTER|Corolla|Renegade|208|CRETA|TRACKER|COMPASS|S10|HR-V|Civic|Cruze|Polo|Virtus|Gol|Fox|Argo|Toro|Cronos|Mobi|Uno|March|Versa|Sentra|Sandero|Logan|Captur|Kwid|Duster|EcoSport|Ka|Ranger|Hilux|SW4|Yaris|Etios|Cobalt|Prisma|Montana|Saveiro|Amarok|Tiguan|Jetta|Passat|Golf|Up|Voyage|Kombi|Fusca))/i)
        || extractText(block, /alt="([^"]+)"/)
        || "";

      // Title from the <h3> or title attribute
      const titleMatch = block.match(/<h3[^>]*>\s*([^<]+)/);
      const brandFromH3 = titleMatch ? titleMatch[1].trim() : "";

      // Version/subtitle
      const versionMatch = block.match(/(?:checkmark|car|rocket|fire|star|zap|top|heart|balloon|dash|family)[^<]*<\/span>\s*/) 
        || block.match(/[✅🚗🚀🔝⚡❤️🎈💨👨‍👩‍👧‍👦💎🔥]\s*([^<]+)/);
      let version = "";
      if (versionMatch) {
        version = block.match(/[✅🚗🚀🔝⚡❤️🎈💨💎🔥👨‍👩‍👧‍👦]\s*([^<]+)/)?.[1]?.trim() || "";
      }

      // Year
      const yearMatch = block.match(/(\d{4})\/(\d{4})/);
      const yearMake = yearMatch ? parseInt(yearMatch[1]) : parseInt(year);
      const yearModel = yearMatch ? parseInt(yearMatch[2]) : parseInt(year);

      // KM
      const kmMatch = block.match(/([\d.]+)\s*km/i);
      const mileage = kmMatch ? parseInt(kmMatch[1].replace(/\./g, "")) : 0;

      // Price
      const priceMatches = [...block.matchAll(/R\$[^<]*?<[^>]*>\s*\*?\s*([\d.]+(?:,\d+)?)/g)];
      let priceCents = 0;
      let oldPriceCents = null;
      
      // Check for "por R$" pattern (promotion)
      const promoPrice = block.match(/por\s+R\$[^<]*?<[^>]*>\s*\*?\s*([\d.]+)/);
      const oldPrice = block.match(/de\s+R\$\s*([\d.]+)/);
      
      if (promoPrice) {
        priceCents = parsePriceBRL(promoPrice[1]);
        if (oldPrice) oldPriceCents = parsePriceBRL(oldPrice[1]);
      } else {
        // Regular price: look for R$ followed by strong with number
        const regularPrice = block.match(/R\$[^<]*<\/[^>]*>\s*<[^>]*>([\d.]+)/);
        if (regularPrice) {
          priceCents = parsePriceBRL(regularPrice[1]);
        } else {
          const simplePrice = block.match(/\*\*R\$\*\*\s*\*\*([\d.,]+)\*\*/);
          if (simplePrice) priceCents = parsePriceBRL(simplePrice[1]);
        }
      }

      // Image
      const imgMatch = block.match(/src="(https:\/\/resized-images\.autoconf\.com\.br\/[^"]+)"/);
      const imageUrl = imgMatch ? imgMatch[1] : null;

      // Build title
      const fullTitle = brandFromH3 || `${brandSlug} ${modelSlug}`.replace(/-/g, " ");

      vehicles.push({
        externalId,
        path,
        brandSlug,
        title: decodeHtml(fullTitle),
        brand: decodeHtml(brandFromH3.split(" ")[0] || brandSlug),
        model: decodeHtml(brandFromH3.split(" ").slice(1).join(" ") || modelSlug),
        version: decodeHtml(version),
        yearMake,
        yearModel,
        priceCents,
        oldPriceCents,
        mileage,
        imageUrl,
        promotion: oldPriceCents !== null,
      });
    } catch (e) {
      console.error("Erro parseando card:", e.message);
    }
  }
  return vehicles;
}

// ── Parse detail page ─────────────────────────────────────────────────
function parseDetailPage(html) {
  // All images
  const images = [];
  const imgRegex = /src="(https:\/\/resized-images\.autoconf\.com\.br\/[^"]+)"/g;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    // Normalize to a decent size
    const url = m[1].replace(/\/\d+x\d+\//, "/800x600/");
    if (!images.includes(url)) images.push(url);
  }

  // Color
  const color = extractText(html, /Branco|Preto|Prata|Cinza|Vermelho|Azul|Marrom|Bege|Verde|Dourado|Amarelo|Laranja|Vinho|Bordo|Grafite|Bronze/i, 0) || "";

  // Doors
  const doorsMatch = html.match(/(\d)\s*portas/i);
  const doors = doorsMatch ? parseInt(doorsMatch[1]) : 4;

  // Body type
  const bodyType = extractText(html, /Hatch|Sed[aã]|SUV|Picape|Pick-?up|Van|Minivan|Wagon|Perua|Utilitário/i, 0) || "";

  // Fuel
  const fuel = extractText(html, /Flex|Gasolina|Diesel|Elétrico|Gasolina e Elétrico|Etanol/i, 0) || "";

  // Transmission
  const transmission = extractText(html, /Manual|Automático|Automatizado|CVT/i, 0) || "";

  // Opcionais - extract from the options section
  const optionsList = [];
  const optionsSection = html.match(/Opcionais[\s\S]*?(?=Ficha|Todo estoque|Informações|$)/i);
  if (optionsSection) {
    const optRegex = /(?:^|\n)\s*([A-ZÀ-Ú][a-zà-ú][\w\s/\-()éêãõáàíóúç]+)/gm;
    let om;
    while ((om = optRegex.exec(optionsSection[0])) !== null) {
      const opt = om[1].trim();
      if (opt.length > 2 && opt.length < 60 && !opt.match(/^(Opcionais|Todo|Até|Informações)/)) {
        optionsList.push(opt);
      }
    }
  }

  // Description
  let description = "";
  const descSection = html.match(/Informações[\s\S]*?(?=Simulação|Whatsapp|Compartilhar|Sugestões|$)/i);
  if (descSection) {
    description = descSection[0]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/^\s*\+?\s*Informações\s*/i, "")
      .trim()
      .slice(0, 3000);
  }

  // Store/unit
  const storeMatch = html.match(/Este veículo está na loja\s*(?:<[^>]+>)*\s*([^<]+)/i);
  const store = storeMatch ? storeMatch[1].trim() : "";

  // Brand from meta
  const metaBrand = extractText(html, /meta-product:brand[^>]*content="([^"]+)"/i) 
    || extractText(html, /product:brand"\s+content="([^"]+)"/i)
    || "";

  // Price from meta (more reliable)
  const metaPrice = extractText(html, /product:price:amount"\s+content="([\d.]+)"/i);

  return { images, color, doors, bodyType, fuel, transmission, options: optionsList, description, store, metaBrand, metaPrice };
}

// ── Main ──────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString, application_name: "dagoberto_easycar_sync" });
await client.connect();

// Advisory lock to prevent concurrent runs
const lock = await client.query("select pg_try_advisory_lock(hashtext('easycar_sync')) as locked");
if (!lock.rows[0]?.locked) {
  console.log("Sincronização anterior ainda ativa; ignorando.");
  await client.end();
  process.exit(0);
}

// Check if sync is enabled
const configResult = await client.query("select value from sync_config where key='easycar_enabled'").catch(() => ({ rows: [] }));
if (configResult.rows[0]?.value === "false") {
  console.log("Sync desabilitada no painel.");
  await client.query("select pg_advisory_unlock(hashtext('easycar_sync'))").catch(() => {});
  await client.end();
  process.exit(0);
}

const run = await client.query("insert into sync_runs(source_id) values ($1) returning id", [SOURCE_ID]);
const runId = run.rows[0].id;
let processed = 0, created = 0, updated = 0, skipped = 0, errors = 0;

try {
  // 1. Discover total pages from first listing page
  console.log("Buscando listagem de estoque...");
  const firstPage = await fetchPage(`${BASE}/estoque?registros_por_pagina=${PER_PAGE}&pagina=1`);
  
  // Find total vehicles count
  const totalMatch = firstPage.match(/(\d+)\s*veículos?\s*encontrados?/i);
  const totalVehicles = totalMatch ? parseInt(totalMatch[1]) : 200;
  const totalPages = Math.ceil(totalVehicles / PER_PAGE);
  console.log(`Total: ${totalVehicles} veículos em ${totalPages} páginas`);

  // 2. Collect all vehicles from listing pages
  const allVehicles = [];
  const seenIds = new Set();

  for (let page = 1; page <= totalPages; page++) {
    console.log(`Página ${page}/${totalPages}...`);
    const html = page === 1 ? firstPage : await fetchPage(`${BASE}/estoque?registros_por_pagina=${PER_PAGE}&pagina=${page}`);
    const pageVehicles = parseListingPage(html);
    
    for (const v of pageVehicles) {
      if (!seenIds.has(v.externalId)) {
        seenIds.add(v.externalId);
        allVehicles.push(v);
      }
    }
    
    if (page < totalPages) await sleep(800); // rate limiting
  }

  console.log(`Encontrados ${allVehicles.length} veículos únicos`);

  // 3. For each vehicle, fetch detail page and upsert
  for (const vehicle of allVehicles) {
    processed++;
    try {
      console.log(`[${processed}/${allVehicles.length}] ${vehicle.title} (${vehicle.externalId})...`);
      
      // Fetch detail page
      await sleep(500); // rate limiting
      const detailHtml = await fetchPage(`${BASE}${vehicle.path}`);
      const detail = parseDetailPage(detailHtml);

      const slug = slugify(`${vehicle.title}-${vehicle.yearModel}-${vehicle.externalId}`);
      const priceCents = detail.metaPrice ? Math.round(parseFloat(detail.metaPrice) * 100) : vehicle.priceCents;
      const brand = detail.metaBrand || vehicle.brand;

      const result = await client.query(
        `insert into vehicles(
          source_id, external_id, slug, title, brand, model, version,
          year_make, year_model, price_cents, old_price_cents, mileage,
          fuel, transmission, body_type, city, color, doors,
          description, image_url, images, options, store,
          status, featured, promotion
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
          'published', false, $24
        )
        on conflict (source_id, external_id) do update set
          slug=excluded.slug, title=excluded.title, brand=excluded.brand, model=excluded.model,
          version=excluded.version, year_make=excluded.year_make, year_model=excluded.year_model,
          price_cents=excluded.price_cents, old_price_cents=excluded.old_price_cents,
          mileage=excluded.mileage, fuel=excluded.fuel, transmission=excluded.transmission,
          body_type=excluded.body_type, color=excluded.color, doors=excluded.doors,
          description=excluded.description, image_url=excluded.image_url, images=excluded.images,
          options=excluded.options, store=excluded.store, promotion=excluded.promotion,
          updated_at=now()
        returning (xmax = 0) as inserted`,
        [
          SOURCE_ID, vehicle.externalId, slug, vehicle.title,
          brand, vehicle.model, vehicle.version || detail.fuel,
          vehicle.yearMake, vehicle.yearModel, priceCents,
          vehicle.oldPriceCents, vehicle.mileage,
          detail.fuel || vehicle.version, detail.transmission || "",
          detail.bodyType || "", "Osasco/SP", detail.color, detail.doors,
          detail.description, vehicle.imageUrl,
          JSON.stringify(detail.images), JSON.stringify(detail.options),
          detail.store, vehicle.promotion,
        ]
      );

      if (result.rows[0].inserted) created++;
      else updated++;
    } catch (e) {
      errors++;
      console.error(`Erro no veículo ${vehicle.externalId}:`, e.message);
    }
  }

  // 4. Mark vehicles that are no longer in the source as paused
  if (allVehicles.length > 10) {
    const activeIds = allVehicles.map(v => v.externalId);
    const removed = await client.query(
      `update vehicles set status='paused', updated_at=now()
       where source_id=$1 and external_id is not null
       and external_id != all($2::text[])
       and status='published'`,
      [SOURCE_ID, activeIds]
    );
    skipped = removed.rowCount || 0;
    if (skipped > 0) console.log(`${skipped} veículos removidos do estoque (pausados)`);
  }

} catch (e) {
  errors++;
  console.error("Erro geral:", e.message);
} finally {
  await client.query(
    "update sync_runs set finished_at=now(), processed=$2, created=$3, updated=$4, skipped=$5, errors=$6 where id=$1",
    [runId, processed, created, updated, skipped, errors]
  ).catch(() => {});
  await client.query("select pg_advisory_unlock(hashtext('easycar_sync'))").catch(() => {});
  await client.end();
}

console.log(JSON.stringify({ processed, created, updated, skipped, errors }));
