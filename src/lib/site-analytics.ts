/** Classificação das visitas usada pelo contador e pela Central de visitas. */

export const SECTION_LABELS: Record<string, string> = {
  home: "Página inicial",
  estoque: "Estoque (lista)",
  veiculo: "Anúncio de veículo",
  marca: "Páginas por marca",
  cidade: "Páginas por cidade",
  financiamento: "Financiamento",
  "financia-facil": "Financia Fácil",
  "venda-seu-carro": "Venda seu carro",
  "encontre-seu-carro": "Encontre seu carro",
  atacado: "Atacado",
  parceiros: "Seja parceiro",
  contato: "Contato",
  sobre: "Sobre",
  outros: "Outras páginas",
};

/** Seções que representam um serviço oferecido (usado no ranking de serviços). */
export const SERVICE_SECTIONS = ["financiamento", "financia-facil", "venda-seu-carro", "encontre-seu-carro", "atacado", "parceiros", "contato"];

export const SOURCE_LABELS: Record<string, string> = {
  direto: "Direto / digitado",
  google: "Google (orgânico)",
  google_ads: "Google Ads",
  meta: "Instagram / Facebook",
  meta_ads: "Meta Ads",
  whatsapp: "WhatsApp",
  outros_buscadores: "Outros buscadores",
  site_externo: "Outros sites",
  interno: "Navegação interna",
};

export function sectionOf(path: string) {
  if (path === "/" || path === "") return { section: "home", vehicleSlug: null as string | null };
  const vehicle = path.match(/^\/veiculos\/([^/]+)\/?$/);
  if (vehicle) return { section: "veiculo", vehicleSlug: decodeURIComponent(vehicle[1]).slice(0, 200) };
  if (/^\/veiculos\/?$/.test(path)) return { section: "estoque", vehicleSlug: null };
  if (path.startsWith("/carros-em/")) return { section: "cidade", vehicleSlug: null };
  if (path.startsWith("/carros/")) return { section: "marca", vehicleSlug: null };
  const first = path.split("/")[1] ?? "";
  if (SECTION_LABELS[first]) return { section: first, vehicleSlug: null };
  return { section: "outros", vehicleSlug: null };
}

export function sourceOf(referrer: string, siteHost: string, utm: { source: string; medium: string }, params: URLSearchParams) {
  const utmSource = utm.source.toLowerCase();
  const medium = utm.medium.toLowerCase();
  const paid = /cpc|ppc|paid|ads/.test(medium);
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid") || (/google/.test(utmSource) && paid)) return "google_ads";
  if (params.has("fbclid") && paid) return "meta_ads";
  if (/facebook|instagram|meta|fb|ig/.test(utmSource)) return paid ? "meta_ads" : "meta";
  if (/whats/.test(utmSource)) return "whatsapp";
  if (utmSource === "google") return "google";

  let host = "";
  try { host = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : ""; } catch {}
  if (!host) return params.has("fbclid") ? "meta" : "direto";
  if (host === siteHost.replace(/^www\./, "")) return "interno";
  if (/(^|\.)google\./.test(host)) return "google";
  if (/facebook\.com|instagram\.com|fb\.com|l\.messenger/.test(host)) return "meta";
  if (/whatsapp\.com|wa\.me/.test(host)) return "whatsapp";
  if (/bing\.com|yahoo\.|duckduckgo|ecosia|yandex/.test(host)) return "outros_buscadores";
  return "site_externo";
}

export function deviceOf(userAgent: string) {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(userAgent)) return "celular";
  return "computador";
}

export function isBot(userAgent: string) {
  return !userAgent || /bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|vercel/i.test(userAgent);
}
