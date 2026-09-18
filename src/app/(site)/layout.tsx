import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MetaPixelProvider } from "@/components/MetaPixelProvider";
import { MessageCircle } from "lucide-react";
import "./site.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MetaPixelProvider pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ""}>
      <div className="autodrive-site">
        <Header />
        <main>{children}</main>
        <Footer />
        <a className="whatsapp-float" href="https://wa.me/5511934718276?text=Olá!%20Vim%20pelo%20site%20da%20Autodrive%20e%20gostaria%20de%20atendimento." target="_blank" rel="noreferrer" aria-label="Falar pelo WhatsApp" title="Falar pelo WhatsApp"><MessageCircle size={24} aria-hidden="true" /></a>
      </div>
    </MetaPixelProvider>
  );
}
