"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const NAV = [
  { href: "/admin", icon: "📊", label: "Dashboard" },
  { href: "/admin/veiculos", icon: "🚗", label: "Veículos" },
  { href: "/admin/banners", icon: "🖼️", label: "Banners e Home" },
  { href: "/admin/leads", icon: "📋", label: "Leads / Contatos" },
  { href: "/admin/depoimentos", icon: "⭐", label: "Depoimentos" },
  { href: "/admin/parceiros", icon: "🤝", label: "Parceiros" },
  { href: "/admin/atacado", icon: "🏢", label: "Leads de Parceiros" },
  { href: "/admin/sync", icon: "🔄", label: "Sincronização" },
  { href: "/admin/configuracoes/integracoes/meta", icon: "🛒", label: "Catálogo Meta" },
  { href: "/admin/configuracoes", icon: "⚙️", label: "Configurações" },
];

function remainingLabel(deadline: number, now: number) {
  const minutes = Math.max(0, Math.ceil((deadline - now) / 60_000));
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  return `${Math.floor(minutes / (24 * 60))}d ${Math.floor((minutes % (24 * 60)) / 60)}h`;
}

function AdminSessionTimer({ initialExpiresAt }: { initialExpiresAt: number | null }) {
  const [deadline, setDeadline] = useState(initialExpiresAt);
  const [now, setNow] = useState<number | null>(null);
  const lastRefresh = useRef(0);
  const refreshing = useRef(false);
  const signingOut = useRef(false);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/admin/login?expirou=1");
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch("/api/auth/session/refresh", {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      });
      if (response.status === 401) {
        await signOut();
        return;
      }
      const body = await response.json();
      if (response.ok) setDeadline(typeof body.expiresAt === "number" ? body.expiresAt : null);
      lastRefresh.current = Date.now();
    } catch {
      // Mantém o prazo atual; uma falha momentânea de rede não estende a sessão.
    } finally {
      refreshing.current = false;
    }
  }, [signOut]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ expiresAt: number | null }>).detail;
      setDeadline(typeof detail?.expiresAt === "number" ? detail.expiresAt : null);
      lastRefresh.current = Date.now();
    };
    window.addEventListener("autodrive:session-updated", update);
    return () => window.removeEventListener("autodrive:session-updated", update);
  }, []);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (deadline !== null && current >= deadline) void signOut();
    }, 15_000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, [deadline, signOut]);

  useEffect(() => {
    if (deadline === null) return;
    const activity = () => {
      const current = Date.now();
      const nearExpiry = deadline - current < 90_000;
      if (nearExpiry || current - lastRefresh.current >= 30_000) void refresh();
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, activity));
  }, [deadline, refresh]);

  if (deadline === null) return <span className="adm-session-expiry">Sessão sem limite automático</span>;
  return <span className="adm-session-expiry">Sessão: {now === null ? "ativa" : remainingLabel(deadline, now)}</span>;
}

export function AdminLayout({
  children,
  user,
  sessionExpiresAt,
}: {
  children: React.ReactNode;
  user?: string;
  sessionExpiresAt: number | null;
}) {
  const pathname = usePathname();
  return (
    <div className="adm">
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <img src="/brand/logo-footer.png" alt="Autodrive Veículos" />
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
          <AdminSessionTimer initialExpiresAt={sessionExpiresAt} />
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
