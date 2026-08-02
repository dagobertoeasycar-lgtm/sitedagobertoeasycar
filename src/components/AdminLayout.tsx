"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", icon: "📊", label: "Dashboard" },
  { href: "/admin/veiculos", icon: "🚗", label: "Veículos" },
  { href: "/admin/banners", icon: "🖼️", label: "Banners e Home" },
  { href: "/admin/leads", icon: "📋", label: "Leads / Contatos" },
  { href: "/admin/sync", icon: "🔄", label: "Sincronização" },
  { href: "/admin/configuracoes/integracoes/meta", icon: "🛒", label: "Catálogo Meta" },
  { href: "/admin/configuracoes", icon: "⚙️", label: "Configurações" },
];

export function AdminLayout({ children, user }: { children: React.ReactNode; user?: string }) {
  const pathname = usePathname();
  return (
    <div className="adm">
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <img src="/brand/logo-horizontal.png" alt="Dagoberto Easycar" />
          <span>Painel Admin</span>
        </div>
        <nav className="adm-nav">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={`adm-nav-item${pathname === n.href ? " active" : ""}`}>
              <span className="adm-nav-icon">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="adm-sidebar-footer">
          {user && <span className="adm-user">👤 {user}</span>}
          <form action="/api/auth/logout" method="post">
            <button className="adm-logout">Sair</button>
          </form>
        </div>
      </aside>
      <div className="adm-content">{children}</div>
    </div>
  );
}
