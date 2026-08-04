import Link from "next/link";
import { MetaTrackedAnchor } from "@/components/MetaPixelEvents";

export function Header() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Dagoberto Easycar - início">
          <img src="/brand/logo-horizontal.png" alt="Dagoberto Easycar Veículos" width={220} height={72} />
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/veiculos">Estoque</Link>
          <Link href="/financiamento">Financiamento</Link>
          <MetaTrackedAnchor href="https://wa.me/5511934718276?text=Olá! Gostaria de simular um financiamento." target="_blank" rel="noreferrer" eventName="InitiateVehicleFinancing" eventParameters={{ lead_type: "financing" }} custom>Simule Online</MetaTrackedAnchor>
          <Link href="/venda-seu-carro">Venda seu carro</Link>
          <Link href="/atacado">Atacado</Link>
          <Link href="/sobre">Sobre nós</Link>
          <Link href="/contato">Contato</Link>
        </nav>
        <div className="header-actions">
          <a className="header-phone" href="tel:+5511934718276">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            (11) 93471-8276
          </a>
          <a className="button button-small header-cta" href="https://wa.me/5511934718276" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 0 0 .612.616l4.535-1.474A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 0 1-5.39-1.578l-.387-.232-2.695.876.9-2.65-.254-.404A9.93 9.93 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            WhatsApp
          </a>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Abrir menu">Menu</summary>
          <nav aria-label="Navegação móvel">
            <Link href="/">Início</Link>
            <Link href="/veiculos">Estoque</Link>
            <Link href="/financiamento">Financiamento</Link>
            <MetaTrackedAnchor href="https://wa.me/5511934718276?text=Olá! Gostaria de simular um financiamento." target="_blank" rel="noreferrer" eventName="InitiateVehicleFinancing" eventParameters={{ lead_type: "financing" }} custom>Simule Online</MetaTrackedAnchor>
            <Link href="/venda-seu-carro">Venda seu carro</Link>
            <Link href="/atacado">Atacado</Link>
            <Link href="/sobre">Sobre nós</Link>
            <Link href="/contato">Contato</Link>
            <a href="tel:+5511934718276">📞 (11) 93471-8276</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
