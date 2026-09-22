import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { CIDADES, listBrandLandings } from "@/lib/seo-landings";

const BASE = "https://www.appautodrive.com.br";

const FIXAS = [
  "",
  "/veiculos",
  "/encontre-seu-carro",
  "/venda-seu-carro",
  "/parceiros",
  "/sobre",
  "/financiamento",
  "/financia-facil",
  "/contato",
  "/privacidade",
  "/termos",
];

/**
 * O sitemap inclui cada anúncio publicado e as páginas por marca e por cidade.
 * Sem os anúncios, o Google depende só dos links internos para achar o estoque.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [brands, vehicles] = await Promise.all([
    listBrandLandings().catch(() => []),
    query<{ slug: string; updated_at: Date }>(
      "select slug, updated_at from vehicles where status='published' and coalesce(slug,'') <> '' order by updated_at desc limit 5000",
    ).then((r) => r.rows).catch(() => []),
  ]);

  return [
    ...FIXAS.map((path) => ({
      url: `${BASE}${path}`,
      lastModified: new Date(),
      changeFrequency: (path === "/veiculos" ? "daily" : "monthly") as "daily" | "monthly",
      priority: path === "" ? 1 : 0.7,
    })),
    ...brands.map((brand) => ({
      url: `${BASE}/carros/${brand.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...CIDADES.map((cidade) => ({
      url: `${BASE}/carros-em/${cidade.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...vehicles.map((vehicle) => ({
      url: `${BASE}/veiculos/${vehicle.slug}`,
      lastModified: vehicle.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
