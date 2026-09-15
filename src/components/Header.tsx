import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Autodrive Veículos - início">
          <img src="/brand/logo-horizontal.png" alt="Autodrive Veículos" width={220} height={72} />
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <Link href="/">Início</Link>
          <Link href="/veiculos">Estoque</Link>
          <Link href="/encontre-seu-carro">Encontre seu carro</Link>
          <Link href="/venda-seu-carro">Venda seu carro</Link>
          <Link href="/financiamento">Financiamento</Link>
          <Link href="/parceiros">Parceiros</Link>
          <Link href="/sobre">Sobre nós</Link>
          <Link href="/contato">Contato</Link>
        </nav>
        <div className="header-actions">
          <a className="header-phone" href="tel:+5511934718276">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            (11) 93471-8276
          </a>
          <Link className="button button-small header-cta" href="/venda-seu-carro">Anunciar meu carro</Link>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Abrir menu">Menu</summary>
          <nav aria-label="Navegação móvel">
            <Link href="/">Início</Link>
            <Link href="/veiculos">Estoque</Link>
            <Link href="/encontre-seu-carro">Encontre seu carro</Link>
            <Link href="/venda-seu-carro">Venda seu carro</Link>
            <Link href="/financiamento">Financiamento</Link>
            <Link href="/parceiros">Parceiros</Link>
            <Link href="/sobre">Sobre nós</Link>
            <Link href="/contato">Contato</Link>
            <a href="tel:+5511934718276">(11) 93471-8276</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
