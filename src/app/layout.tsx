import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const siteUrl = "https://www.dagobertoeasycar.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Carros usados e seminovos em Osasco | Dagoberto Easycar", template: "%s | Dagoberto Easycar" },
  description: "Veículos usados e seminovos periciados em Osasco, financiamento e atendimento especializado.",
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "pt_BR", url: siteUrl, siteName: "Dagoberto Easycar", title: "Dagoberto Easycar Veículos", description: "Veículos periciados, com procedência." },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["AutoDealer", "LocalBusiness"],
    name: "Dagoberto Easycar Veículos",
    url: siteUrl,
    telephone: "+55 11 93471-8276",
    email: "meucomercioonline5@gmail.com",
    address: { "@type": "PostalAddress", streetAddress: "Avenida dos Autonomistas, 5334, Km 18", addressLocality: "Osasco", addressRegion: "SP", postalCode: "06194-060", addressCountry: "BR" },
  };
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <a className="whatsapp-float" href="https://wa.me/5511934718276" target="_blank" rel="noreferrer" aria-label="Falar pelo WhatsApp">WhatsApp</a>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
