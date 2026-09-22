"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell, Building2, CarFront, CircleDollarSign, ClipboardList, Handshake, Image, LayoutGrid, Link2,
  LogOut, MessageSquareQuote, Plus, RefreshCw, Search, Settings, ShoppingBag, Star, TriangleAlert,
  BarChart3, History, Tag, UserCog, Users, Warehouse, type LucideIcon,
} from "lucide-react";
import type { AdminOverview } from "@/lib/admin-overview";
import { canAccess, ROLES, type Area } from "@/lib/permissions-shared";

type NavItem = { href: string; icon: LucideIcon; label: string; area: Area; match?: string[] };

// Ordem e nomes seguem o protótipo do painel novo; itens próprios da Autodrive
// (parceiros, atacado, depoimentos, Meta) entram nos pontos equivalentes.
const NAV: NavItem[] = [
  { href: "/admin", icon: LayoutGrid, label: "Dashboard", area: "dashboard" },
  { href: "/admin/veiculos", icon: CarFront, label: "Anúncios / Veículos", area: "veiculos", match: ["/admin/veiculos/"] },
  { href: "/admin/veiculos/novo", icon: Plus, label: "Novo anúncio", area: "veiculos" },
  { href: "/admin/estoque", icon: Warehouse, label: "Estoque", area: "veiculos" },
  { href: "/admin/banners", icon: Image, label: "Banners e Home", area: "banners" },
  { href: "/admin/promocoes", icon: Tag, label: "Promoções", area: "banners" },
  { href: "/admin/leads", icon: ClipboardList, label: "Leads / Contatos", area: "leads" },
  { href: "/admin/financiamentos", icon: CircleDollarSign, label: "Financiamentos", area: "leads" },
  { href: "/admin/atacado", icon: Building2, label: "Leads de parceiros", area: "leads" },
  { href: "/admin/sync", icon: RefreshCw, label: "Importações", area: "importacoes" },
  { href: "/admin/parceiros", icon: Handshake, label: "Fontes e parceiros", area: "importacoes" },
  { href: "/admin/configuracoes/integracoes/meta", icon: ShoppingBag, label: "Catálogo Meta", area: "meta" },
  { href: "/admin/depoimentos", icon: MessageSquareQuote, label: "Depoimentos", area: "banners" },
  { href: "/admin/usuarios", icon: Users, label: "Usuários e permissões", area: "usuarios" },
  { href: "/admin/auditoria", icon: History, label: "Auditoria", area: "auditoria" },
  { href: "/admin/relatorios", icon: BarChart3, label: "Relatórios", area: "relatorios" },
  { href: "/admin/configuracoes", icon: Settings, label: "Configurações", area: "configuracoes", match: ["/admin/configuracoes/precificacao", "/admin/trocar-senha"] },
];

const QUICK: NavItem[] = [
  { href: "/admin/veiculos/novo", icon: Plus, label: "Novo anúncio", area: "veiculos" },
  { href: "/admin/sync", icon: RefreshCw, label: "Importar veículos", area: "importacoes" },
  { href: "/admin/leads", icon: ClipboardList, label: "Ver leads", area: "leads" },
];


function isActive(pathname: string, item: NavItem) {
  if (pathname === item.href) return true;
  // Um item com endereço exato (ex.: Novo anúncio) ganha do prefixo de outro.
  if (NAV.some((other) => other !== item && other.href === pathname)) return false;
  return item.match?.some((path) => pathname.startsWith(path)) ?? false;
}

const TZ = "America/Sao_Paulo";

function syncLabel(date: Date | string | null) {
  if (!date) return "Nunca";
  const value = new Date(date);
  const time = value.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  const sameDay = value.toLocaleDateString("pt-BR", { timeZone: TZ }) === new Date().toLocaleDateString("pt-BR", { timeZone: TZ });
  return sameDay ? `Hoje, ${time}` : `${value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ })}, ${time}`;
}

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

  if (deadline === null) return <span className="ad-session">Sessão sem limite automático</span>;
  return <span className="ad-session">Sessão: {now === null ? "ativa" : remainingLabel(deadline, now)}</span>;
}

export function AdminLayout({
  children,
  user,
  role,
  sessionExpiresAt,
  overview,
}: {
  children: React.ReactNode;
  user?: string;
  role?: string;
  sessionExpiresAt: number | null;
  overview: AdminOverview;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  return (
    <div className={`adm ad-shell${menuOpen ? " ad-menu-open" : ""}`}>
      <aside className="ad-sidebar">
        <Link href="/admin" className="ad-brand">
          <img src="/brand/autodrive-logo.png" alt="Autodrive Veículos" />
        </Link>
        <nav className="ad-nav" aria-label="Menu do painel">
          {NAV.filter((item) => canAccess(role, item.area)).map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`ad-nav-item${isActive(pathname, item) ? " active" : ""}`}>
                <Icon size={17} strokeWidth={2} aria-hidden />{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ad-quick">
          <span className="ad-quick-title">Atalhos rápidos</span>
          {QUICK.filter((item) => canAccess(role, item.area)).map((item) => {
            const Icon = item.icon;
            return <Link key={item.label} href={item.href}><Icon size={15} aria-hidden />{item.label}</Link>;
          })}
        </div>
        <div className="ad-sidebar-footer">
          <AdminSessionTimer initialExpiresAt={sessionExpiresAt} />
          <form action="/api/auth/logout" method="post">
            <button className="ad-logout"><LogOut size={15} aria-hidden />Sair</button>
          </form>
        </div>
      </aside>
      <button type="button" className="ad-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />

      <div className="ad-main">
        <header className="ad-topbar">
          <button type="button" className="ad-menu-toggle" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>☰</button>
          <form className="ad-search" action="/admin/veiculos">
            <Search size={16} aria-hidden />
            <input name="q" placeholder="Buscar no painel: veículo, placa, código…" aria-label="Buscar no painel" />
          </form>
          <div className="ad-topbar-status">
            <Link href="/admin/sync" className={overview.syncEnabled ? "ad-sync-on" : "ad-sync-off"}>
              {overview.syncEnabled ? "Sincronização ativa" : "Sincronização pausada"}
            </Link>
            <span>Última atualização: <strong>{syncLabel(overview.lastSync)}</strong></span>
            <Link href="/admin/veiculos?status=draft">Publicações pendentes: <strong>{overview.pending}</strong></Link>
          </div>
          <Link href="/admin/leads?status=new" className="ad-bell" aria-label={`${overview.newLeads} leads novos`}>
            <Bell size={19} aria-hidden />
            {overview.newLeads > 0 && <span>{overview.newLeads > 99 ? "99+" : overview.newLeads}</span>}
          </Link>
          <div className="ad-user">
            <UserCog size={18} aria-hidden />
            <div><strong>{ROLES[(role ?? "") as keyof typeof ROLES] ?? "Usuário"}</strong><small>{user}</small></div>
          </div>
        </header>

        <AdminKpis overview={overview} />

        <main className="adm-content ad-content">{children}</main>
      </div>
    </div>
  );
}

function percent(part: number, total: number) {
  if (!total) return "0%";
  return `${((part / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function leadTrend(today: number, yesterday: number) {
  if (!yesterday) return today ? "Nenhum ontem" : "Sem leads ontem";
  const diff = Math.round(((today - yesterday) / yesterday) * 100);
  return `${diff >= 0 ? "+" : ""}${diff}% vs ontem`;
}

function AdminKpis({ overview }: { overview: AdminOverview }) {
  const cards: Array<{ href: string; icon: LucideIcon; label: string; value: number; note: string; warn?: boolean }> = [
    { href: "/admin/veiculos?status=published", icon: CarFront, label: "Total de anúncios ativos", value: overview.published, note: `+${overview.publishedToday} hoje` },
    { href: "/admin/veiculos?featured=1", icon: Star, label: "Veículos em destaque", value: overview.featured, note: `${percent(overview.featured, overview.published)} do total` },
    { href: "/admin/leads", icon: ClipboardList, label: "Leads recebidos hoje", value: overview.leadsToday, note: leadTrend(overview.leadsToday, overview.leadsYesterday) },
    { href: "/admin/banners", icon: Image, label: "Banners ativos", value: overview.banners, note: "na home" },
    { href: "/admin/parceiros", icon: Link2, label: "Fontes integradas", value: overview.sources, note: overview.sourceErrors ? `${overview.sourcesOnline} online` : "Todas online" },
    { href: "/admin/sync", icon: TriangleAlert, label: "Erros de importação", value: overview.sourceErrors, note: overview.sourceErrors ? "Ver detalhes" : "Nenhum erro", warn: overview.sourceErrors > 0 },
  ];
  return (
    <section className="ad-kpis" aria-label="Indicadores">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link key={card.label} href={card.href} className={`ad-kpi${card.warn ? " warn" : ""}`}>
            <span className="ad-kpi-label">{card.label}</span>
            <span className="ad-kpi-value"><Icon size={22} strokeWidth={1.8} aria-hidden />{card.value.toLocaleString("pt-BR")}</span>
            <span className="ad-kpi-note">{card.note}</span>
          </Link>
        );
      })}
    </section>
  );
}
