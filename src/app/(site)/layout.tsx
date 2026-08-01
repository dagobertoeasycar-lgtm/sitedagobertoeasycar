import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <a className="whatsapp-float" href="https://wa.me/5511934718276" target="_blank" rel="noreferrer" aria-label="Falar pelo WhatsApp">WhatsApp</a>
    </>
  );
}
