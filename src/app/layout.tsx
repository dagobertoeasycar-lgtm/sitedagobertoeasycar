import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://www.dagobertoeasycar.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Carros usados e seminovos | Auto Drive Veículos", template: "%s | Auto Drive Veículos" },
  description: "Vários parceiros, vários modelos para todos os gostos e negociação fácil e rápida. Veículos com procedência e financiamento.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", url: siteUrl, siteName: "Auto Drive Veículos", title: "Auto Drive Veículos", description: "Vários parceiros, vários modelos para todos os gostos e negociação fácil e rápida." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["AutoDealer", "LocalBusiness"],
    name: "Auto Drive Veículos",
    url: siteUrl,
    telephone: "+55 11 93471-8276",
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
