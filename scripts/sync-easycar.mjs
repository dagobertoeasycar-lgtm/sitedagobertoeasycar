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
const PER_PAGE = 20;
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

function decodeHtml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function slugify(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Parse listing page ────────────────────────────────────────────────
function parseListingPage(html) {
  const vehicles = [];
  const seenIds = new Set();

  const cards = html.split(/class="card card-car/g);
  cards.shift();

  for (const card of cards) {
    try {
      const urlMatch = card.match(/href="[^"]*\/carros\/([^/]+)\/([^/]+)\/(\d+)\/(\d+)"/);
      if (!urlMatch) continue;
      const [, brandSlug, modelSlug, , externalId] = urlMatch;
      if (seenIds.has(externalId)) continue;
      seenIds.add(externalId);

      const imgMatch = card.match(/\bsrc="(https:\/\/resized-images\.autoconf\.com\.br\/[^"]+)"/);
      const imageUrl = imgMatch ? imgMatch[1] : null;

      const h3Match = card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
      let brand = "", model = "";
      if (h3Match) {
        const h3Text = stripTags(h3Match[1]);
        const parts = h3Text.split(" ").filter(Boolean);
        brand = parts[0] || "";
        model = parts.slice(1).join(" ") || "";
      }
      const title = brand && model ? `${brand} ${model}` : `${brandSlug} ${modelSlug}`;

      const versionMatch = card.match(/<p class="fw-bold">\s*([\s\S]*?)\s*<\/p>/);
      let version = "";
      if (versionMatch) {
        version = stripTags(versionMatch[1]).replace(/^[^\w\d]*/, "").trim();
      }

      const detailSection = card.match(/car-detail-info([\s\S]*?)card-footer/);
      let yearMake = 0, yearModel = 0, mileage = 0;
      if (detailSection) {
        const yearMatch = detailSection[1].match(/(\d{4})\/(\d{4})/);
        if (yearMatch) { yearMake = parseInt(yearMatch[1]); yearModel = parseInt(yearMatch[2]); }
        const kmMatch = detailSection[1].match(/([\d.]+)\s*km/i);
        if (kmMatch) mileage = parseInt(kmMatch[1].replace(/\./g, ""));
      }

      const footerSection = card.match(/card-footer([\s\S]*?)$/);
      let priceCents = 0, oldPriceCents = null;
      if (footerSection) {
        const priceMatch = footerSection[1].match(/<strong[^>]*>\s*([\d.]+(?:,\d{2})?)\s*<\/strong>/);
        if (priceMatch) priceCents = Math.round(parseFloat(priceMatch[1].replace(/\./g, "").replace(",", ".")) * 100);
        const oldMatch = footerSection[1].match(/(?:<s>|de\b)[^<]*?(\d[\d.]+(?:,\d{2})?)/);
        if (oldMatch) oldPriceCents = Math.round(parseFloat(oldMatch[1].replace(/\./g, "").replace(",", ".")) * 100);
      }

      const path = `/carros/${brandSlug}/${modelSlug}/${yearModel || "0"}/${externalId}`;
      vehicles.push({
        externalId, path, brandSlug, title: decodeHtml(title),
        brand: decodeHtml(brand), model: decodeHtml(model),
        version: decodeHtml(version),
        yearMake, yearModel, priceCents, oldPriceCents, mileage, imageUrl,
        promotion: oldPriceCents !== null && oldPriceCents > priceCents,
      });
    } catch (e) { console.error("Erro parseando card:", e.message); }
  }
  return vehicles;
}

// ── Parse detail page ─────────────────────────────────────────────────
function parseDetailPage(html) {
  // ── Images from JavaScript JSON array (let photos = [...]) ──
  const images = [];
  const photosMatch = html.match(/let\s+photos\s*=\s*(\[[\s\S]*?\]);/);
  if (photosMatch) {
    try {
      const photos = JSON.parse(photosMatch[1]);
      for (const photo of photos) {
        // Use desktop size (1440x0) for high quality
        const url = photo.desktop || photo.carousel || photo.url || "";
        if (url && !images.includes(url)) images.push(url);
      }
    } catch (e) { console.error("Erro parseando photos JSON:", e.message); }
  }

  // ── Video from gallery.push ──
  let videoUrl = "";
  const videoMatch = html.match(/gallery\.push\(\s*\{\s*"src"\s*:\s*"(https?:\/\/(?:youtu\.be|(?:www\.)?youtube\.com)[^"]+)"\s*\}\s*\)/);
  if (videoMatch) videoUrl = videoMatch[1];

  // ── Ficha técnica from tech-specs-item ──
  let color = "", doors = 4, bodyType = "", fuel = "", transmission = "";
  const ftSection = html.match(/Ficha técnica([\s\S]*?)(?:Opcionais|Informações)/);
  if (ftSection) {
    const itemRegex = /tech-specs-item[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g;
    let im;
    while ((im = itemRegex.exec(ftSection[1])) !== null) {
      const val = stripTags(im[1]).trim();
      if (!val) continue;
      if (/manual|autom[aá]tic|automatizado|cvt/i.test(val)) transmission = val;
      else if (/branco|preto|prata|cinza|vermelho|azul|marrom|bege|verde|dourado|amarelo|laranja|vinho|bordo|grafite|bronze/i.test(val)) color = val;
      else if (/porta/i.test(val)) { const d = val.match(/(\d)/); if (d) doors = parseInt(d[1]); }
      else if (/hatch|sed[aã]|suv|picape|pick.?up|van|minivan|wagon|perua|utilitário|conversível|cupê|coupe/i.test(val)) bodyType = val;
      else if (/flex|gasolina|diesel|el[eé]trico|etanol|híbrido|gnv/i.test(val)) fuel = val;
    }
  }
  // Fuel fallback from title
  if (!fuel) {
    const titleMatch = html.match(/<title>([^<]+)/i);
    if (titleMatch) {
      const t = titleMatch[1];
      if (/flex/i.test(t)) fuel = "Flex";
      else if (/diesel/i.test(t)) fuel = "Diesel";
      else if (/gasolina/i.test(t)) fuel = "Gasolina";
      else if (/el[eé]trico/i.test(t)) fuel = "Elétrico";
      else if (/etanol/i.test(t)) fuel = "Etanol";
      else if (/h[ií]brido/i.test(t)) fuel = "Híbrido";
    }
  }

  // ── Opcionais from class="acessorios" ──
  const optionsList = [];
  const opSection = html.match(/Opcionais([\s\S]*?)(?:\+ Informações)/);
  if (opSection) {
    const optRegex = /class="acessorios"[^>]*>[\s\S]*?<\/svg>\s*([\s\S]*?)\s*<\/p>/g;
    let om;
    while ((om = optRegex.exec(opSection[1])) !== null) {
      const clean = stripTags(om[1]).trim();
      if (clean && clean.length > 1 && clean.length < 80) optionsList.push(clean);
    }
  }

  // ── + Informações ──
  let description = "";
  const infoMatch = html.match(/\+ Informações[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
  if (infoMatch) description = stripTags(infoMatch[1]).trim().slice(0, 5000);

  // ── Store ──
  const storeMatch = html.match(/Este veículo está na loja[\s\S]*?<a[^>]*>([^<]+)/i)
    || html.match(/loja\s*<[^>]*>([^<]+)/i);
  const store = storeMatch ? storeMatch[1].trim() : "";

  // ── Meta tags ──
  const metaBrand = (html.match(/product:brand"\s+content="([^"]+)"/i) || [])[1] || "";
  const metaPrice = (html.match(/product:price:amount"\s+content="([\d.]+)"/i) || [])[1] || "";

  return { images, videoUrl, color, doors, bodyType, fuel, transmission, options: optionsList, description, store, metaBrand, metaPrice };
}

// ── Main ──────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString, application_name: "dagoberto_easycar_sync" });
await client.connect();

const lock = await client.query("select pg_try_advisory_lock(hashtext('easycar_sync')) as locked");
if (!lock.rows[0]?.locked) {
  console.log("Sincronização anterior ainda ativa; ignorando.");
  await client.end();
  process.exit(0);
}

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
  console.log("Buscando listagem de estoque...");
  const firstPage = await fetchPage(`${BASE}/estoque?registros_por_pagina=${PER_PAGE}&pagina=1`);

  const totalMatch = firstPage.match(/<strong>(\d+)<\/strong>\s*ve[ií]culos?\s*encontrados?/i);
  const totalVehicles = totalMatch ? parseInt(totalMatch[1]) : 200;
  const totalPages = Math.ceil(totalVehicles / PER_PAGE);
  console.log(`Total: ${totalVehicles} veículos em ${totalPages} páginas`);

  const allVehicles = [];
  for (let page = 1; page <= totalPages; page++) {
    console.log(`Página ${page}/${totalPages}...`);
    const html = page === 1 ? firstPage : await fetchPage(`${BASE}/estoque?registros_por_pagina=${PER_PAGE}&pagina=${page}`);
    const pageVehicles = parseListingPage(html);
    console.log(`  -> ${pageVehicles.length} veículos encontrados`);
    allVehicles.push(...pageVehicles);
    if (page < totalPages) await sleep(800);
  }

  console.log(`Total encontrados: ${allVehicles.length} veículos únicos`);

  for (const vehicle of allVehicles) {
    processed++;
    try {
      console.log(`[${processed}/${allVehicles.length}] ${vehicle.title} (${vehicle.externalId})...`);
      await sleep(500);
      const detailHtml = await fetchPage(`${BASE}${vehicle.path}`);
      const detail = parseDetailPage(detailHtml);

      console.log(`  fotos: ${detail.images.length}, video: ${detail.videoUrl ? 'sim' : 'não'}, opcionais: ${detail.options.length}, desc: ${detail.description.length} chars`);

      const slug = slugify(`${vehicle.title}-${vehicle.yearModel}-${vehicle.externalId}`);
      const priceCents = detail.metaPrice ? Math.round(parseFloat(detail.metaPrice) * 100) : vehicle.priceCents;
      const brand = detail.metaBrand || vehicle.brand;

      // Build media array: video first (if exists), then all photos
      const media = [];
      if (detail.videoUrl) media.push({ type: "video", url: detail.videoUrl });
      for (const img of detail.images) media.push({ type: "image", url: img });

      const result = await client.query(
        `insert into vehicles(
          source_id, external_id, slug, title, brand, model, version,
          year_make, year_model, price_cents, old_price_cents, mileage,
          fuel, transmission, body_type, city, color, doors,
          description, image_url, images, options, store,
          status, featured, promotion, video_url
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
          'published', false, $24, $25
        )
        on conflict (source_id, external_id) do update set
          slug=excluded.slug, title=excluded.title, brand=excluded.brand, model=excluded.model,
          version=excluded.version, year_make=excluded.year_make, year_model=excluded.year_model,
          price_cents=excluded.price_cents, old_price_cents=excluded.old_price_cents,
          mileage=excluded.mileage, fuel=excluded.fuel, transmission=excluded.transmission,
          body_type=excluded.body_type, color=excluded.color, doors=excluded.doors,
          description=excluded.description, image_url=excluded.image_url, images=excluded.images,
          options=excluded.options, store=excluded.store, promotion=excluded.promotion, video_url=excluded.video_url,
          updated_at=now()
        returning (xmax = 0) as inserted`,
        [
          SOURCE_ID, vehicle.externalId, slug, vehicle.title,
          brand, vehicle.model, vehicle.version,
          vehicle.yearMake, vehicle.yearModel, priceCents,
          vehicle.oldPriceCents, vehicle.mileage,
          detail.fuel || "", detail.transmission || "",
          detail.bodyType || "", "Osasco/SP", detail.color, detail.doors,
          detail.description, vehicle.imageUrl,
          JSON.stringify(media), JSON.stringify(detail.options),
          detail.store, vehicle.promotion, detail.videoUrl || "",
        ]
      );

      if (result.rows[0].inserted) created++;
      else updated++;
    } catch (e) {
      errors++;
      console.error(`Erro no veículo ${vehicle.externalId}:`, e.message);
    }
  }

  // Mark removed vehicles as paused
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
