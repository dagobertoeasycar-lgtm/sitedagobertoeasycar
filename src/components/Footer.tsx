import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <Image src="/brand/logo-horizontal.png" alt="Dagoberto Easycar Veículos" width={210} height={68} />
          <p>Veículos periciados, com procedência. Tradição, transparência e dedicação.</p>
        </div>
        <div>
          <strong>Navegação</strong>
          <Link href="/veiculos">Veículos</Link>
          <Link href="/financiamento">Financiamento</Link>
          <Link href="/venda-seu-carro">Venda seu carro</Link>
          <Link href="/admin/login">Acesso administrativo</Link>
        </div>
        <div>
          <strong>Contato</strong>
          <a href="tel:+5511934718276">(11) 93471-8276</a>
          <a href="mailto:meucomercioonline5@gmail.com">meucomercioonline5@gmail.com</a>
          <p>Avenida dos Autonomistas, 5334<br />Km 18 — Osasco/SP<br />CEP 06194-060</p>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} Dagoberto Easycar.</span>
        <span><Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos</Link></span>
      </div>
    </footer>
  );
}
