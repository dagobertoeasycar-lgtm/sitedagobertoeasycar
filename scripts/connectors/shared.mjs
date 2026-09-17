/**
 * Utilidades comuns aos conectores de estoque de parceiro.
 *
 * Todo conector devolve veículos no MESMO formato normalizado, para o motor
 * de sincronização não precisar saber de qual plataforma o carro veio:
 *
 *   {
 *     externalId, slug, title, brand, model, version,
 *     yearMake, yearModel, originPriceCents, oldPriceCents, promotion,
 *     mileage, fuel, transmission, bodyType, color, doors,
 *     description, imageUrl, media[], options[],
 *     plate, vehicleType, sourceUrl
 *   }
 */

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

/** Teto do integer do banco: ~R$ 20.000.000,00 */
export const MAX_CENTS = 2000000000;
export const MAX_MILEAGE = 2000000;

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

export function cleanText(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:lt|gt);/gi, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aceita 39870, "39.870,00", "R$ 39.870" e devolve centavos. */
export function toCents(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.min(Math.round(value * 100), MAX_CENTS) : 0;
  }
  let texto = String(value).replace(/[^\d.,-]/g, "");
  if (texto.includes(",")) texto = texto.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(texto);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n * 100), MAX_CENTS);
}

export function toInt(value) {
  const n = Number.parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function clampMileage(value) {
  const n = toInt(value);
  return n > MAX_MILEAGE ? MAX_MILEAGE : n;
}

async function pedir(url, { accept = "text/html", timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9" },
      redirect: "follow",
    });
    if (!res.ok) {
      // 403/429 atrás de CDN quase nunca é erro de código: é bloqueio por
      // reputação do IP de origem. Os runners do GitHub Actions ficam em
      // faixas muito usadas para raspagem, e a Cloudflare barra por padrão.
      // A mesma URL responde 200 de um IP comum.
      const cdn = res.headers.get("cf-ray") ? "Cloudflare" : res.headers.get("server") || "CDN";
      if (res.status === 403 || res.status === 429) {
        throw new Error(
          `HTTP ${res.status} em ${url} — ${cdn} bloqueou a requisição. ` +
            `Não é erro do conector: o site responde normalmente de um IP comum. ` +
            `Rode a sincronização de um servidor próprio, ou peça ao parceiro para liberar o acesso.`,
        );
      }
      throw new Error(`HTTP ${res.status} em ${url}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url, options) {
  return (await pedir(url, options)).text();
}

export async function fetchJson(url, options) {
  return (await pedir(url, { accept: "application/json", ...options })).json();
}

/**
 * Extrai um array JSON de dentro de um texto grande equilibrando colchetes.
 * Necessário porque o payload RSC do Next traz JSON cru no meio de HTML,
 * onde regex ganancioso quebra em qualquer string com colchete dentro.
 */
export function extractJsonArray(texto, chave) {
  const marca = texto.indexOf(`"${chave}":`);
  if (marca < 0) return null;
  const inicio = texto.indexOf("[", marca);
  if (inicio < 0) return null;
  let profundidade = 0;
  let dentroDeString = false;
  let escapado = false;
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (escapado) { escapado = false; continue; }
    if (c === "\\") { escapado = true; continue; }
    if (c === '"') { dentroDeString = !dentroDeString; continue; }
    if (dentroDeString) continue;
    if (c === "[") profundidade++;
    else if (c === "]") {
      profundidade--;
      if (profundidade === 0) {
        try { return JSON.parse(texto.slice(inicio, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

/** Remonta o payload RSC que o Next app router injeta na página. */
export function readRscPayload(html) {
  const pedacos = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => m[1]);
  let texto = "";
  for (const p of pedacos) {
    try { texto += JSON.parse(`"${p}"`); } catch { /* pedaço quebrado: segue */ }
  }
  return texto;
}

export function readNextData(html) {
  const m = html.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

/** Tipos que NÃO entram quando o parceiro está filtrado para carros. */
const NAO_E_CARRO = [
  "moto", "scooter", "triciclo", "quadriciclo",
  "caminhao", "onibus", "reboque", "implemento",
  "barco", "lancha", "jet", "nautica", "aeronave",
];

/**
 * Decide se o veículo entra, conforme o filtro configurado no parceiro.
 * Regra conservadora: só descarta o que é reconhecidamente não-carro. Tipo
 * desconhecido ou vazio passa, para não perder carro por rótulo novo.
 */
export function passaFiltroTipo(vehicleType, filtro) {
  if (filtro !== "cars") return true;
  const t = String(vehicleType ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (!t) return true;
  return !NAO_E_CARRO.some((p) => t.includes(p));
}

/** Monta o registro normalizado, aplicando os limites do banco. */
export function normalizeVehicle(dados) {
  const brand = cleanText(dados.brand);
  const model = cleanText(dados.model);
  const version = cleanText(dados.version);
  const title = cleanText(dados.title) || [brand, model].filter(Boolean).join(" ");
  const yearModel = toInt(dados.yearModel) || toInt(dados.yearMake);
  const yearMake = toInt(dados.yearMake) || yearModel;

  const media = (dados.media || [])
    .map((url) => (typeof url === "string" ? url : url?.url))
    .filter((url) => typeof url === "string" && /^https?:\/\//.test(url))
    .map((url) => ({ type: "image", url }));

  return {
    externalId: String(dados.externalId),
    slug: slugify(`${title} ${version} ${yearModel} ${dados.externalId}`),
    title,
    brand,
    model,
    version,
    yearMake,
    yearModel,
    originPriceCents: dados.originPriceCents,
    oldPriceCents: dados.oldPriceCents ?? null,
    promotion: Boolean(dados.promotion),
    mileage: clampMileage(dados.mileage),
    fuel: cleanText(dados.fuel),
    transmission: cleanText(dados.transmission),
    bodyType: cleanText(dados.bodyType),
    color: cleanText(dados.color),
    doors: toInt(dados.doors) || 4,
    description: cleanText(dados.description).slice(0, 5000),
    imageUrl: media[0]?.url ?? null,
    media,
    options: (dados.options || []).map((o) => cleanText(typeof o === "string" ? o : o?.nome)).filter(Boolean),
    plate: cleanText(dados.plate).toUpperCase().replace(/[^A-Z0-9]/g, "") || null,
    vehicleType: cleanText(dados.vehicleType) || null,
    sourceUrl: dados.sourceUrl || null,
  };
}
