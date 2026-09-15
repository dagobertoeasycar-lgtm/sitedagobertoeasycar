import type { Metadata } from "next";
import "./globals.css";
import { ENDERECO } from "@/lib/endereco";

const siteUrl = "https://www.dagobertoeasycar.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Autodrive Veículos & Tecnologia | Carros usados e seminovos", template: "%s | Autodrive Veículos" },
  description: "Veículos próprios, de parceiros e particulares em um só atendimento. Compra, venda, financiamento e busca de carros usados e seminovos em Barueri e Osasco.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", url: siteUrl, siteName: "Autodrive Veículos & Tecnologia", title: "Autodrive Veículos & Tecnologia", description: "Mais opções. Um só atendimento para comprar, vender ou financiar seu veículo." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["AutoDealer", "LocalBusiness"],
    name: "Autodrive Veículos & Tecnologia",
    url: siteUrl,
    telephone: "+55 11 93471-8276",
    address: {
      "@type": "PostalAddress",
      addressLocality: ENDERECO.cidade,
      addressRegion: ENDERECO.estado,
      addressCountry: "BR",
    },
    areaServed: { "@type": "State", name: "São Paulo" },
  };
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
