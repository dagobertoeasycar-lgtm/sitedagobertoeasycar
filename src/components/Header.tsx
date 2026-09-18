"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, MessageCircle, Phone } from "lucide-react";

const navItems = [
  ["Início", "/"], ["Estoque", "/veiculos"],
  ["Encontre seu carro", "/encontre-seu-carro"], ["Venda seu carro", "/venda-seu-carro"],
  ["Financiamento", "/financiamento"], ["Parceiros", "/parceiros"],
  ["Sobre nós", "/sobre"], ["Contato", "/contato"],
] as const;

export function Header() {
  const pathname = usePathname();
  const mobileMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }, [pathname]);

  const navigation = navItems.map(([label, href]) => (
    <Link key={href} href={href}
      aria-current={pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)) ? "page" : undefined}
      onClick={() => { if (mobileMenu.current) mobileMenu.current.open = false; }}>
      {label}
    </Link>
  ));

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Autodrive Veículos - início">
          <img src="/brand/autodrive-logo.png" alt="Autodrive Veículos" width={202} height={32} />
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {navigation}
        </nav>
        <div className="header-actions">
          <a className="button header-whatsapp" href="https://wa.me/5511934718276" target="_blank" rel="noreferrer">
            <MessageCircle size={18} aria-hidden="true" /> WhatsApp
          </a>
        </div>
        <details className="mobile-menu" ref={mobileMenu}>
          <summary aria-label="Abrir menu" title="Menu"><Menu size={22} aria-hidden="true" /></summary>
          <nav aria-label="Navegação móvel">
            {navigation}
            <a href="tel:+5511934718276"><Phone size={16} aria-hidden="true" /> (11) 93471-8276</a>
            <a className="button" href="https://wa.me/5511934718276" target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" /> WhatsApp</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
