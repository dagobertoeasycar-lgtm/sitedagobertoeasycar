/**
 * Conector de plataforma sobre Supabase com Next.js app router — os veículos
 * vêm no payload RSC que a página injeta no HTML.
 * Usado pelo Guiotti Multimarcas.
 *
 * Particularidade: o estoque mistura carro e moto. O campo vehicle_type
 * separa os dois, e o filtro do parceiro decide o que entra.
 *
 * config: { baseUrl, listPath, pageParam?, startPage?, maxPages?, vehicleFilter? }
 */
import { extractJsonArray, fetchText, normalizeVehicle, passaFiltroTipo, readRscPayload, sleep, toCents, toInt } from "./shared.mjs";

export const id = "guiotti_rsc";
export const label = "Supabase / Next app router (payload RSC)";

function mapear(v, baseUrl) {
  const venda = toCents(v.sale_price ?? v.price);
  const cheio = toCents(v.price);
  const temPromo = venda > 0 && cheio > venda;

  const partes = [
    v.version,
    v.color ? `Cor ${v.color}` : "",
    v.transmission ? `Câmbio ${v.transmission}` : "",
    v.fuel_type || "",
    v.displacement_cc ? `${v.displacement_cc} cc` : "",
  ].filter(Boolean);

  return normalizeVehicle({
    externalId: v.id,
    title: [v.brand, v.model].filter(Boolean).join(" "),
    brand: v.brand,
    model: v.model,
    version: v.version,
    yearMake: v.manufacturing_year,
    yearModel: v.model_year,
    originPriceCents: venda || cheio,
    oldPriceCents: temPromo ? cheio : null,
    promotion: temPromo,
    mileage: v.mileage,
    fuel: v.fuel_type,
    transmission: v.transmission,
    bodyType: v.body_style || v.motorcycle_style || "",
    color: v.color,
    doors: v.vehicle_type === "motocicleta" ? 0 : 4,
    description: v.description || partes.join(" · "),
    media: Array.isArray(v.images) ? v.images : [],
    options: Array.isArray(v.features) ? v.features : [],
    plate: v.license_plate,
    vehicleType: v.vehicle_type_custom || v.vehicle_type,
    sourceUrl: v.public_slug ? `${baseUrl}/veiculo/${v.public_slug}` : `${baseUrl}/estoque`,
  });
}

export async function collect(config, log = console.log) {
  const baseUrl = String(config.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("connector_config.baseUrl é obrigatório");
  const listPath = config.listPath || "/estoque";
  const pageParam = config.pageParam || "page";
  const startPage = Number.isFinite(Number(config.startPage)) ? Number(config.startPage) : 1;
  const maxPages = toInt(config.maxPages) || 8;

  const vistos = new Set();
  const saida = [];
  let anunciado = null;
  let descartadosPorTipo = 0;

  for (let i = 0; i < maxPages; i++) {
    const pagina = startPage + i;
    const url = i === 0 ? `${baseUrl}${listPath}` : `${baseUrl}${listPath}?${pageParam}=${pagina}`;
    if (i > 0) await sleep(500);

    const html = await fetchText(url);
    const rsc = readRscPayload(html);
    const itens = extractJsonArray(rsc, "vehicles");

    if (anunciado == null) {
      const rotulo = rsc.match(/"children":\[(\d+)," ve[íi]culo"/);
      anunciado = rotulo ? toInt(rotulo[1]) : null;
      log(`  Supabase/RSC: ${anunciado ?? "?"} veículo(s) anunciado(s)`);
    }
    if (!Array.isArray(itens) || !itens.length) break;

    let novos = 0;
    for (const item of itens) {
      if (!item || item.id == null) continue;
      const chave = String(item.id);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      novos++;

      if (item.is_active === false) continue;
      if (item.status && item.status !== "available") continue;

      const veiculo = mapear(item, baseUrl);
      if (!passaFiltroTipo(veiculo.vehicleType, config.vehicleFilter)) { descartadosPorTipo++; continue; }
      if (!veiculo.title || !veiculo.originPriceCents) continue;
      saida.push(veiculo);
    }

    if (!novos) break;
    if (anunciado != null && vistos.size >= anunciado) break;
  }

  if (descartadosPorTipo) log(`  ${descartadosPorTipo} veículo(s) fora do filtro de tipo (moto/outros)`);
  return saida;
}
