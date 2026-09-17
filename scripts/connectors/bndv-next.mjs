/**
 * Conector BNDV em Next.js (pages router) — dados em __NEXT_DATA__.
 * Usado pelo Justo Car.
 *
 * Lê a própria página de listagem em vez do endpoint /_next/data, porque
 * aquele depende do buildId, que muda a cada deploy do parceiro.
 *
 * config: { baseUrl, listPath, pageParam?, startPage?, maxPages?, vehicleFilter? }
 */
import { fetchText, normalizeVehicle, passaFiltroTipo, readNextData, sleep, toCents, toInt } from "./shared.mjs";

export const id = "bndv_next";
export const label = "BNDV / Next.js (__NEXT_DATA__)";

function mapear(v, baseUrl) {
  const preco = toCents(v.price);
  const promo = toCents(v.promotionalPrice);
  const temPromo = promo > 0 && promo < preco;

  const fotos = Array.isArray(v.photos) ? v.photos.slice() : [];
  if (v.mainPhoto && !fotos.includes(v.mainPhoto)) fotos.unshift(v.mainPhoto);

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
    bodyType: v.category === "carro" ? "" : v.category,
    color: v.color,
    doors: v.doors,
    description: v.description,
    media: fotos,
    options: Array.isArray(v.optionals) ? v.optionals : [],
    plate: v.plate,
    vehicleType: v.category,
    sourceUrl: `${baseUrl}${v.id ? `/anuncio/carro/${v.id}` : ""}`,
  });
}

export async function collect(config, log = console.log) {
  const baseUrl = String(config.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("connector_config.baseUrl é obrigatório");
  const listPath = config.listPath || "/seminovos";
  const pageParam = config.pageParam || "pag";
  const startPage = Number.isFinite(Number(config.startPage)) ? Number(config.startPage) : 0;
  const maxPages = toInt(config.maxPages) || 30;

  const vistos = new Set();
  const saida = [];
  let total = null;

  for (let i = 0; i < maxPages; i++) {
    const pagina = startPage + i;
    const url = `${baseUrl}${listPath}?${pageParam}=${pagina}`;
    if (i > 0) await sleep(500);

    const html = await fetchText(url);
    const dados = readNextData(html);
    const anuncios = dados?.props?.pageProps?.ads;
    const itens = Array.isArray(anuncios?.items) ? anuncios.items : [];

    if (total == null) {
      total = toInt(anuncios?.paginationOut?.totalRows) || null;
      log(`  BNDV/Next: ${total ?? "?"} veículo(s) anunciado(s)`);
    }
    if (!itens.length) break;

    let novos = 0;
    for (const item of itens) {
      if (!item || item.id == null) continue;
      const chave = String(item.id);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      novos++;

      const veiculo = mapear(item, baseUrl);
      if (!passaFiltroTipo(veiculo.vehicleType, config.vehicleFilter)) continue;
      if (!veiculo.title || !veiculo.originPriceCents) continue;
      saida.push(veiculo);
    }

    // Nenhum id inédito nesta página: a paginação já deu a volta.
    if (!novos) break;
    if (total != null && vistos.size >= total) break;
  }

  return saida;
}
