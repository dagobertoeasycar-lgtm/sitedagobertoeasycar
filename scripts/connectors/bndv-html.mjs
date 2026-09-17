/**
 * Conector BNDV em site próprio, sem API — a listagem vem em HTML.
 * Usado pelo Now Car.
 *
 * A listagem tem foto, ano, km, título, preço e o id do anúncio. A página de
 * detalhe acrescenta combustível, cor, câmbio, portas e a galeria completa,
 * então por padrão ela é visitada (fetchDetails).
 *
 * Os campos da ficha são classificados por PADRÃO, não por posição: se o
 * parceiro deixar de informar a cor, o câmbio não passa a ser lido como cor.
 *
 * config: { baseUrl, listPath, detailPath?, fetchDetails?, maxDetails?, vehicleFilter? }
 */
import { cleanText, fetchText, normalizeVehicle, passaFiltroTipo, sleep, toCents, toInt } from "./shared.mjs";

export const id = "bndv_html";
export const label = "BNDV / site próprio (HTML)";

const COMBUSTIVEIS = ["flex", "gasolina", "diesel", "alcool", "álcool", "etanol", "eletrico", "elétrico", "hibrido", "híbrido", "gnv"];
const CAMBIOS = ["manual", "automatico", "automático", "automatizado", "cvt", "semi-automatico", "semiautomático"];

function semAcento(v) {
  return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Descobre o que cada <li> da ficha significa pelo formato do conteúdo. */
function classificarFicha(itens) {
  const out = { yearMake: 0, yearModel: 0, mileage: 0, fuel: "", transmission: "", color: "" };
  for (const bruto of itens) {
    const texto = cleanText(bruto);
    if (!texto) continue;
    const t = semAcento(texto);

    const anos = texto.match(/(\d{4})\s*\/\s*(\d{4})/);
    if (anos) { out.yearMake = toInt(anos[1]); out.yearModel = toInt(anos[2]); continue; }

    if (/\bkm\b/i.test(texto)) { out.mileage = toInt(texto); continue; }
    if (COMBUSTIVEIS.some((c) => t === semAcento(c) || t.includes(semAcento(c)))) { out.fuel = texto; continue; }
    if (CAMBIOS.some((c) => t === semAcento(c))) { out.transmission = texto; continue; }
    if (!out.color && /^[\p{L}\s-]{3,20}$/u.test(texto)) out.color = texto;
  }
  return out;
}

function imagensDe(html) {
  const urls = [...html.matchAll(/https?:\/\/[^"'\s]*blob\.core\.windows\.net[^"'\s]*?\.(?:jpe?g|png|webp)/gi)].map((m) => m[0]);
  const cdn = [...html.matchAll(/https?:\/\/cdn-sistema-lojistas\.bndv\.com\.br[^"'\s]*?\.(?:jpe?g|png|webp)/gi)].map((m) => m[0]);
  return [...new Set([...urls, ...cdn])];
}

function lerListagem(html, baseUrl, detailPath) {
  const cartoes = html.split(/class="[^"]*psCard[^"]*"/).slice(1);
  const saida = [];
  for (const cartao of cartoes) {
    const idm = cartao.match(new RegExp(`${detailPath.replace("/", "\\/")}\\/(\\d+)`));
    if (!idm) continue;
    const titulo = cleanText((cartao.match(/class="titlecard"[^>]*>([\s\S]*?)<\//) || [])[1]);
    const preco = (cartao.match(/R\$\s*[\d.,]+/) || [])[0] || "";
    const lis = [...cartao.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/<[^>]+>/g, " "));
    saida.push({
      externalId: idm[1],
      title: titulo,
      priceRaw: preco,
      ficha: classificarFicha(lis),
      imagens: imagensDe(cartao),
      url: `${baseUrl}${detailPath}/${idm[1]}`,
    });
  }
  return saida;
}

function lerDetalhe(html) {
  const titulo = cleanText((html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1]);
  const preco = (html.match(/<h3[^>]*>\s*(R\$\s*[\d.,]+)/i) || [])[1] || "";

  const bloco = html.match(/<ul[^>]*class="[^"]*listCard[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  const lis = bloco ? [...bloco[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => m[1].replace(/<[^>]+>/g, " ")) : [];
  const ficha = classificarFicha(lis);

  const spans = [...html.matchAll(/class="[^"]*itemCar[^"]*"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((m) => cleanText(m[1]))
    .filter(Boolean);

  let brand = "";
  let model = "";
  let doors = 0;
  for (const s of spans) {
    const portas = s.match(/(\d+)\s*portas?/i);
    if (portas) { doors = toInt(portas[1]); continue; }
    if (/final da placa/i.test(s)) continue;
    if (/\bkm\b/i.test(s)) continue;
    if (CAMBIOS.some((c) => semAcento(s) === semAcento(c))) continue;
    if (!brand) brand = s;
    else if (!model) model = s;
  }

  const observacoes = cleanText(
    (html.match(/Observa[^<]*<\/[^>]+>([\s\S]{0,1200}?)<\/(?:div|section|p)>/i) || [])[1] || "",
  );

  return { titulo, preco, ficha, brand, model, doors, observacoes, imagens: imagensDe(html) };
}

export async function collect(config, log = console.log) {
  const baseUrl = String(config.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("connector_config.baseUrl é obrigatório");
  const listPath = config.listPath || "/seminovos";
  const detailPath = config.detailPath || "/detalhes";
  const buscarDetalhe = config.fetchDetails !== false;
  const maxDetalhes = toInt(config.maxDetails) || 300;

  const html = await fetchText(`${baseUrl}${listPath}`);
  const cartoes = lerListagem(html, baseUrl, detailPath);
  log(`  BNDV/HTML: ${cartoes.length} veículo(s) na listagem`);

  const saida = [];
  let visitados = 0;

  for (const cartao of cartoes) {
    let brand = "";
    let model = "";
    let version = cartao.title;
    let doors = 0;
    let descricao = "";
    let ficha = cartao.ficha;
    let imagens = cartao.imagens;
    let precoRaw = cartao.priceRaw;

    if (buscarDetalhe && visitados < maxDetalhes) {
      try {
        if (visitados > 0) await sleep(350);
        const det = await fetchText(cartao.url);
        visitados++;
        const d = lerDetalhe(det);
        brand = d.brand;
        model = d.model;
        doors = d.doors;
        descricao = d.observacoes;
        version = d.titulo || version;
        if (d.preco) precoRaw = d.preco;
        if (d.imagens.length) imagens = d.imagens;
        ficha = {
          yearMake: d.ficha.yearMake || ficha.yearMake,
          yearModel: d.ficha.yearModel || ficha.yearModel,
          mileage: d.ficha.mileage || ficha.mileage,
          fuel: d.ficha.fuel || ficha.fuel,
          transmission: d.ficha.transmission || ficha.transmission,
          color: d.ficha.color || ficha.color,
        };
      } catch (e) {
        // Detalhe indisponível não descarta o veículo: segue com o cartão.
        log(`  aviso: detalhe de ${cartao.externalId} falhou (${e.message}); usando dados da listagem`);
      }
    }

    // Sem marca/modelo separados, deduz das duas primeiras palavras do título.
    if (!brand || !model) {
      const palavras = (cartao.title || "").split(/\s+/).filter(Boolean);
      brand = brand || palavras[0] || "";
      model = model || palavras[1] || "";
    }

    const veiculo = normalizeVehicle({
      externalId: cartao.externalId,
      title: cartao.title || [brand, model].filter(Boolean).join(" "),
      brand,
      model,
      version,
      yearMake: ficha.yearMake,
      yearModel: ficha.yearModel,
      originPriceCents: toCents(precoRaw),
      mileage: ficha.mileage,
      fuel: ficha.fuel,
      transmission: ficha.transmission,
      color: ficha.color,
      doors,
      description: descricao,
      media: imagens,
      vehicleType: "carro",
      sourceUrl: cartao.url,
    });

    if (!passaFiltroTipo(veiculo.vehicleType, config.vehicleFilter)) continue;
    if (!veiculo.title || !veiculo.originPriceCents) continue;
    saida.push(veiculo);
  }

  return saida;
}
