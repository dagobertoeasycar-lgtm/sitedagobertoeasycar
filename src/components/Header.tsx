import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Dagoberto Easycar - início">
          <Image src="/brand/logo-horizontal.png" alt="Dagoberto Easycar Veículos" width={220} height={72} priority />
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <Link href="/veiculos">Veículos</Link>
          <Link href="/sobre">Sobre nós</Link>
          <Link href="/financiamento">Financiamento</Link>
          <Link href="/venda-seu-carro">Venda seu carro</Link>
          <Link href="/contato">Contato</Link>
        </nav>
        <a className="button button-small header-cta" href="https://wa.me/5511934718276" target="_blank" rel="noreferrer">WhatsApp</a>
        <details className="mobile-menu">
          <summary aria-label="Abrir menu">Menu</summary>
          <nav aria-label="Navegação móvel">
            <Link href="/veiculos">Veículos</Link>
            <Link href="/sobre">Sobre nós</Link>
            <Link href="/financiamento">Financiamento</Link>
            <Link href="/venda-seu-carro">Venda seu carro</Link>
            <Link href="/contato">Contato</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
