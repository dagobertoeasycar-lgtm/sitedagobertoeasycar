/**
 * Leitura do estoque BNDV pela API GraphQL da própria plataforma.
 *
 * POR QUE: Justo Car e Now Car ficam atrás da Cloudflare, que devolve 403 para
 * IP de datacenter (GitHub Actions, Vercel). Os sites delas são montados a
 * partir desta API da BNDV, hospedada na Azure e SEM Cloudflare — a mesma que
 * alimenta o __NEXT_DATA__ da Justo Car. Lendo direto dela o sync funciona da
 * nuvem, sem depender de computador ligado nem de leitores públicos.
 *
 * Os ids dos anúncios são os mesmos dos conectores de HTML (bndv_next e
 * bndv_html), então trocar de fonte não duplica carro no site.
 *
 * Ativado por `connector_config.bndvCompanyId` (id da loja na BNDV: Justo Car
 * 850, Now Car 766). Se a API falhar, os conectores voltam para a leitura do
 * site (plano B), como antes.
 */
import { normalizeVehicle, passaFiltroTipo, sleep, toCents } from "./shared.mjs";
import { ehMarcaDaLoja } from "../../src/lib/vehicle-photos.ts";

export const API_URL = "https://bndv-sites-templates-api.azurewebsites.net/graphql";

const CAMPOS = `id brand model version mileage yearFabrication yearModel doors fuel transmission color plate
  promotionalPrice price description active category subCategory condition optionals photos mainPhoto`;

async function graphql(query, timeout = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`API BNDV: HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(`API BNDV: ${json.errors[0].message}`);
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Todas as páginas da loja. ATENÇÃO: a paginação da API começa em 0 — pedir
 * a página 1 pula os primeiros itens. A lista precisa bater com o total
 * informado pela API; se vier incompleta, lança erro (vai para o plano B) em
 * vez de devolver meia lista, que retiraria carros do site por engano.
 */
async function listar(idCompany, pageSize = 50, maxPages = 40) {
  const itens = [];
  let total = null;
  for (let page = 0; page < maxPages; page++) {
    if (page > 0) await sleep(300);
    const data = await graphql(
      `{ ads_by_company(filters: { idsCompany: [${idCompany}] }, pagination: { page: ${page}, pageSize: ${pageSize} }) {
          paginationOut { totalRows } items { ${CAMPOS} } } }`,
    );
    const r = data?.ads_by_company;
    total = r?.paginationOut?.totalRows ?? total;
    const lote = Array.isArray(r?.items) ? r.items : [];
    itens.push(...lote);
    if (lote.length < pageSize || (total != null && itens.length >= total)) break;
  }
  if (total != null && itens.length < total) throw new Error(`lista incompleta (${itens.length} de ${total})`);
  return itens;
}

function fotosDo(v) {
  const fotos = Array.isArray(v.photos) ? v.photos.slice() : [];
  if (v.mainPhoto && !fotos.includes(v.mainPhoto)) fotos.unshift(v.mainPhoto);
  return [...new Set(fotos.filter((url) => /\/vehicles-images\//i.test(url) && !ehMarcaDaLoja(url)))];
}

function mapear(v, sourceUrl) {
  const preco = toCents(v.price);
  const promo = toCents(v.promotionalPrice);
  const temPromo = promo > 0 && promo < preco;
  return normalizeVehicle({
    externalId: v.id,
    title: [v.brand, v.model].filter(Boolean).join(" "),
    brand: v.brand,
    model: v.model,
    version: v.version,
    yearMake: v.yearFabrication,
    yearModel: v.yearModel,
    originPriceCents: temPromo ? promo : preco,
    oldPriceCents: temPromo ? preco : null,
    promotion: temPromo,
    mileage: v.mileage,
    fuel: v.fuel,
    transmission: v.transmission,
    bodyType: v.subCategory || (v.category === "carro" ? "" : v.category),
    color: v.color,
    doors: v.doors,
    description: v.description,
    media: fotosDo(v),
    options: Array.isArray(v.optionals) ? v.optionals : [],
    plate: v.plate,
    vehicleType: v.category,
    sourceUrl,
  });
}

/**
 * Coleta pela API. `urlDoAnuncio(id)` monta o link do anúncio no site da loja
 * (cada conector sabe o seu formato). Lança erro se a API não responder —
 * quem chama decide o plano B.
 */
export async function collectViaApi(config, urlDoAnuncio, log = console.log) {
  const idCompany = Number(config.bndvCompanyId);
  if (!Number.isInteger(idCompany) || idCompany <= 0) throw new Error("bndvCompanyId inválido");

  const vistos = new Map();
  for (const v of await listar(idCompany)) {
    if (v && v.id != null && v.active !== false && !vistos.has(String(v.id))) vistos.set(String(v.id), v);
  }
  log(`  API BNDV (empresa ${idCompany}): ${vistos.size} veículo(s) anunciado(s)`);

  const saida = [];
  for (const v of vistos.values()) {
    const veiculo = mapear(v, urlDoAnuncio(v.id));
    if (!passaFiltroTipo(veiculo.vehicleType, config.vehicleFilter)) continue;
    if (!veiculo.title || !veiculo.originPriceCents) continue;
    saida.push(veiculo);
  }
  return saida;
}
