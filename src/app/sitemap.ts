import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.dagobertoeasycar.com.br";
  return ["", "/veiculos", "/sobre", "/financiamento", "/venda-seu-carro", "/contato", "/privacidade", "/termos"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "/veiculos" ? "daily" as const : "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
