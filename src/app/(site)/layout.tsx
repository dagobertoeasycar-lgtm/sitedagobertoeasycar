import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MetaPixelProvider } from "@/components/MetaPixelProvider";
import { GoogleAdsConversions } from "@/components/GoogleAdsConversions";
import { getAdsConversions } from "@/lib/settings";
import { EMPTY_ADS_CONVERSIONS } from "@/lib/ads-conversions";
import { MessageCircle } from "lucide-react";
import { Suspense } from "react";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import "./site.css";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const conversions = await getAdsConversions().catch(() => EMPTY_ADS_CONVERSIONS);
  return (
    <MetaPixelProvider pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ""}>
      <div className="autodrive-site">
        <GoogleAdsConversions conversions={conversions} />
        <Suspense fallback={null}><SiteAnalytics /></Suspense>
        <Header />
        <main>{children}</main>
        <Footer />
        <a className="whatsapp-float" href="https://wa.me/5511934718276?text=Olá!%20Vim%20pelo%20site%20da%20Autodrive%20e%20gostaria%20de%20atendimento." target="_blank" rel="noreferrer" aria-label="Falar pelo WhatsApp" title="Falar pelo WhatsApp"><MessageCircle size={24} aria-hidden="true" /></a>
      </div>
    </MetaPixelProvider>
  );
}
