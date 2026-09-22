import { query } from "@/lib/db";

/**
 * Páginas de entrada do Google: uma por marca com estoque e uma por cidade
 * atendida. Só existem marcas que realmente têm veículos publicados — página
 * vazia não ajuda ninguém e o Google trata como conteúdo fraco.
 */
export type Landing = { slug: string; nome: string; total: number };

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Marcas com pelo menos 3 anúncios publicados. */
export async function listBrandLandings(minimo = 3): Promise<Landing[]> {
  const rows = await query<{ brand: string; total: number }>(
    `select brand, count(*)::int as total from vehicles
     where status='published' and coalesce(brand,'') <> ''
     group by brand having count(*) >= $1 order by total desc, brand`,
    [minimo],
  ).then((r) => r.rows).catch(() => []);
  return rows.map((row) => ({ slug: slugify(row.brand), nome: row.brand, total: row.total }));
}

export async function findBrandBySlug(slug: string) {
  const brands = await listBrandLandings(1);
  return brands.find((brand) => brand.slug === slug) ?? null;
}

/** Cidades atendidas pelo escritório de Barueri. */
export const CIDADES = [
  { slug: "barueri", nome: "Barueri", texto: "Nosso escritório fica em Barueri, no Jardim Belval, e atendemos toda a cidade, incluindo Alphaville e região." },
  { slug: "osasco", nome: "Osasco", texto: "Osasco fica a poucos minutos do nosso escritório e é uma das regiões que mais atendemos." },
  { slug: "alphaville", nome: "Alphaville", texto: "Atendimento em Alphaville e arredores, com visita ao veículo combinada por WhatsApp." },
  { slug: "santana-de-parnaiba", nome: "Santana de Parnaíba", texto: "Atendemos Santana de Parnaíba e região, com entrega combinada." },
  { slug: "carapicuiba", nome: "Carapicuíba", texto: "Carapicuíba está na nossa área de atendimento diário." },
  { slug: "jandira", nome: "Jandira", texto: "Jandira e cidades vizinhas fazem parte da nossa rota de atendimento." },
  { slug: "itapevi", nome: "Itapevi", texto: "Itapevi e região contam com o mesmo atendimento do escritório de Barueri." },
  { slug: "sao-paulo", nome: "São Paulo", texto: "Atendemos a capital com agendamento, principalmente a zona oeste e a região da Marginal Pinheiros." },
] as const;

export function findCity(slug: string) {
  return CIDADES.find((cidade) => cidade.slug === slug) ?? null;
}
