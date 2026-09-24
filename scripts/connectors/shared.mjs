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

import { separarFotos } from "../../src/lib/vehicle-photos.ts";

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

/**
 * Faixa de preço aceitável para um carro usado, em centavos.
 *
 * Existe porque o estoque de origem tem valores de espaço reservado digitados
 * à mão quando a loja não quer publicar o preço. Em 17/09/2026 havia sete
 * veículos no ar assim: três Fiorino e um Onix a R$ 3.333.333,33, e um Onix,
 * um Cronos e uma Strada a R$ 1.000.000. A mediana do estoque é R$ 79.000.
 *
 * Preço fora da faixa não vira erro nem some: o veículo entra como rascunho,
 * fica visível no painel e não vai para o site nem para o catálogo da Meta.
 */
export const DEFAULT_PRICE_SANITY = { min_cents: 300000, max_cents: 90000000 };

/** Devolve null se o preço serve, ou o motivo da recusa. */
export function motivoPrecoImplausivel(priceCents, faixa = DEFAULT_PRICE_SANITY) {
  const v = Number(priceCents);
  const min = Number(faixa?.min_cents ?? DEFAULT_PRICE_SANITY.min_cents);
  const max = Number(faixa?.max_cents ?? DEFAULT_PRICE_SANITY.max_cents);
  if (!Number.isFinite(v) || v <= 0) return "sem preço";
  const reais = (c) => `R$ ${(c / 100).toLocaleString("pt-BR")}`;
  if (v < min) return `preço ${reais(v)} abaixo do mínimo aceitável (${reais(min)})`;
  if (v > max) return `preço ${reais(v)} acima do máximo aceitável (${reais(max)})`;
  return null;
}

export function toInt(value) {
  const n = Number.parseInt(String(value ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function clampMileage(value) {
  const n = toInt(value);
  return n > MAX_MILEAGE ? MAX_MILEAGE : n;
}

/**
 * Leitor público usado como plano B quando o CDN do parceiro bloqueia o IP do
 * servidor. Ele busca a página do próprio IP dele e devolve o HTML original.
 * Sem isso, Justo Car e Now Car ficam congeladas: o estoque delas parou em
 * 17/09/2026, com carro vendido ainda no ar.
 */
const LEITORES = [
  { nome: "r.jina.ai", url: (alvo) => `https://r.jina.ai/${alvo}`, headers: (accept) => ({ "x-return-format": accept.includes("json") ? "text" : "html" }) },
  { nome: "allorigins", url: (alvo) => `https://api.allorigins.win/raw?url=${encodeURIComponent(alvo)}`, headers: () => ({}) },
  { nome: "codetabs", url: (alvo) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(alvo)}`, headers: () => ({}) },
];
const LEITOR_TIMEOUT = 60000;

function ehBloqueio(status) {
  return status === 403 || status === 429;
}

async function buscar(url, { accept, timeout, headers = {} }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9", ...headers },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Tenta cada leitor público na ordem; devolve a resposta boa ou o relato das falhas. */
async function tentarLeitores(url, accept) {
  const falhas = [];
  for (const leitor of LEITORES) {
    try {
      const res = await buscar(leitor.url(url), { accept, timeout: LEITOR_TIMEOUT, headers: leitor.headers(accept) });
      if (res.ok) {
        const corpo = await res.text();
        // Proxy que devolve página de erro do CDN responde 200 com pouco texto.
        if (corpo.length > 2000) return { corpo, leitor: leitor.nome };
        falhas.push(`${leitor.nome}: 200 com ${corpo.length} bytes`);
      } else {
        falhas.push(`${leitor.nome}: HTTP ${res.status}`);
      }
    } catch (erro) {
      falhas.push(`${leitor.nome}: ${erro instanceof Error ? erro.message : erro}`);
    }
  }
  return { falhas };
}

async function pedir(url, { accept = "text/html", timeout = 30000 } = {}) {
  const res = await buscar(url, { accept, timeout });
  if (res.ok) return res;

  // 403/429 atrás de CDN quase nunca é erro de código: é bloqueio por
  // reputação do IP de origem. Os runners do GitHub Actions e os servidores em
  // nuvem ficam em faixas muito usadas para raspagem, e a Cloudflare barra por
  // padrão; a mesma URL responde 200 de um IP comum. Antes de desistir,
  // tentamos ler por um leitor público, que busca a página do IP dele.
  const cdn = res.headers.get("cf-ray") ? "Cloudflare" : res.headers.get("server") || "CDN";
  if (ehBloqueio(res.status)) {
    const tentativa = await tentarLeitores(url, accept);
    if (tentativa.corpo) {
      console.log(`  ${cdn} bloqueou o acesso direto; lido pelo ${tentativa.leitor}`);
      return new Response(tentativa.corpo, { status: 200, headers: { "content-type": accept } });
    }
    throw new Error(
      `HTTP ${res.status} em ${url} — ${cdn} bloqueou a requisição e os leitores públicos também falharam ` +
        `(${tentativa.falhas.join("; ")}). Não é erro do conector: o site responde normalmente de um IP comum. ` +
        `Peça ao parceiro um feed (XML/CSV) ou que libere o acesso.`,
    );
  }
  throw new Error(`HTTP ${res.status} em ${url}`);
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

/**
 * Placa só entra se for placa de verdade.
 *
 * Várias origens publicam a placa mascarada ("D**-***0", "ABC-1**4"). Limpar
 * os caracteres especiais transformava isso em "D0" — que parecia uma placa
 * no banco, virava nome de pasta de fotos e servia de chave de deduplicação
 * entre parceiros. Melhor não ter placa do que ter uma inventada.
 *
 * Formatos aceitos: antigo ABC1234 e Mercosul ABC1D23.
 */
export function normalizePlate(valor) {
  const limpa = cleanText(valor).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(limpa) ? limpa : null;
}

/** Monta o registro normalizado, aplicando os limites do banco. */
export function normalizeVehicle(dados) {
  const brand = cleanText(dados.brand);
  const model = cleanText(dados.model);
  const version = cleanText(dados.version);
  const title = cleanText(dados.title) || [brand, model].filter(Boolean).join(" ");
  const yearModel = toInt(dados.yearModel) || toInt(dados.yearMake);
  const yearMake = toInt(dados.yearMake) || yearModel;

  // Arte da loja de origem (logotipo do parceiro, composição de marketing com
  // o nome da revenda) não entra no site: mostrar "TCHESCOCAR" como foto de um
  // carro do catálogo da Auto Drive é anúncio do concorrente. A regra mora em
  // src/lib/vehicle-photos.ts, a mesma que a fila de tratamento usa.
  // A arte fica como último recurso — carro sem imagem nenhuma é pior.
  const { fotos, artesDaLoja } = separarFotos(dados.media || []);
  const media = (fotos.length ? fotos : artesDaLoja).map((url) => ({ type: "image", url }));

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
    plate: normalizePlate(dados.plate),
    vehicleType: cleanText(dados.vehicleType) || null,
    sourceUrl: dados.sourceUrl || null,
  };
}
