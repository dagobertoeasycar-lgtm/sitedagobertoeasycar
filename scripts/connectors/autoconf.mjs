/**
 * Conector Autoconf — plataforma que expõe /api/stock em JSON.
 * Usado por EasyCar e Tchesco Car.
 *
 * config: { baseUrl, perPage?, revendas?: string[], vehicleFilter? }
 */
import { fetchJson, normalizeVehicle, passaFiltroTipo, sleep, toCents, toInt } from "./shared.mjs";

export const id = "autoconf";
export const label = "Autoconf (API /api/stock)";

function mapear(v, baseUrl) {
  const brand = v.marca_apelido || v.marca_nome;
  const model = v.modelopai_nome || v.modelo_nome;
  const version = v.versao_descricao || v.modelo_nome;

  const venda = toCents(v.valorvenda);
  const promo = toCents(v.valorpromocao);
  const temPromo = promo > 0 && promo < venda;

  const fotos = (Array.isArray(v.fotos) ? v.fotos : [])
    .map((f) => (typeof f === "string" ? f : f?.url || f?.photo_url))
    .filter(Boolean);
  if (!fotos.length && v.foto) fotos.push(v.foto);

  return normalizeVehicle({
    externalId: v.id,
    title: [brand, model].filter(Boolean).join(" ") || model,
    brand,
    model,
    version,
    yearMake: v.anofabricacao,
    yearModel: v.anomodelo,
    originPriceCents: temPromo ? promo : venda,
    oldPriceCents: temPromo ? venda : null,
    promotion: temPromo,
    mileage: v.km,
    fuel: v.combustivel_nome,
    transmission: v.cambio_nome,
    bodyType: v.carroceria_nome,
    color: v.cor_nome,
    doors: v.portas,
    description: [
      version,
      v.cor_nome ? `Cor ${v.cor_nome}` : "",
      v.cambio_nome ? `Câmbio ${v.cambio_nome}` : "",
      v.combustivel_nome || "",
      Number(v.pericia) ? "Veículo periciado" : "",
    ].filter(Boolean).join(" · "),
    media: fotos,
    options: Array.isArray(v.acessorios) ? v.acessorios.map((a) => a?.nome) : [],
    // `placa` vem mascarada na API pública ("D**-***0"); a de verdade está em
    // `placa_completa`. Usar a mascarada gerava placa de dois caracteres no
    // banco ("D0") e pasta de fotos sem serventia nenhuma no painel.
    plate: v.placa_completa || v.placa,
    vehicleType: v.tipoveiculo_nome || v.carroceria_nome,
    sourceUrl: `${baseUrl}/estoque`,
    // o dono da loja dentro da plataforma, quando houver várias
    revendaId: v.revenda_id != null ? String(v.revenda_id) : "",
    revendaNome: v.revenda_nome || "",
  });
}

export async function collect(config, log = console.log) {
  const baseUrl = String(config.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("connector_config.baseUrl é obrigatório");
  const perPage = toInt(config.perPage) || 100;
  const filtroRevenda = Array.isArray(config.revendas) ? config.revendas.map(String) : [];

  const url = (pagina) => `${baseUrl}/api/stock?pagina=${pagina}&registros_por_pagina=${perPage}`;

  const primeira = await fetchJson(url(1));
  const total = toInt(primeira.total) || (primeira.data || []).length;
  const paginas = toInt(primeira.total_paginas) || Math.ceil(total / perPage) || 1;
  log(`  Autoconf: ${total} veículo(s) em ${paginas} página(s)`);

  const cru = [...(primeira.data || [])];
  for (let p = 2; p <= paginas; p++) {
    await sleep(400);
    const corpo = await fetchJson(url(p));
    cru.push(...(corpo.data || []));
  }

  const vistos = new Set();
  const saida = [];
  for (const item of cru) {
    if (!item || item.id == null) continue;
    const chave = String(item.id);
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const veiculo = mapear(item, baseUrl);
    if (filtroRevenda.length && !filtroRevenda.includes(veiculo.revendaId)) continue;
    if (!passaFiltroTipo(veiculo.vehicleType, config.vehicleFilter)) continue;
    if (!veiculo.title || !veiculo.originPriceCents) continue;
    saida.push(veiculo);
  }
  return saida;
}
