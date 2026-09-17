import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DashboardStatsRow = {
  vehicles: number;
  published: number;
  leads: number;
  leads_today: number;
  banners: number;
  users: number;
  last_sync: string | null;
};

type OriginStatsRow = {
  own: number;
  partner: number;
  private: number;
  active_partners: number;
  new_today: number;
  price_changed: number;
  unavailable: number;
};

type RecentVehicleRow = {
  id: string;
  title: string;
  status: string;
  price_cents: number;
  image_url: string | null;
  updated_at: Date;
};

type RecentLeadRow = {
  id: string;
  name: string;
  phone: string;
  kind: string;
  status: string;
  created_at: Date;
};

export default async function AdminDashboard() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");

  let stats = { vehicles: 0, published: 0, leads: 0, leadsToday: 0, banners: 0, users: 0, lastSync: "Nunca" };
  try {
    const r = await query<DashboardStatsRow>(`SELECT
      (SELECT count(*) FROM vehicles)::int as vehicles,
      (SELECT count(*) FROM vehicles WHERE status='published')::int as published,
      (SELECT count(*) FROM leads)::int as leads,
      (SELECT count(*) FROM leads WHERE created_at >= CURRENT_DATE)::int as leads_today,
      (SELECT count(*) FROM banners WHERE active=true)::int as banners,
      (SELECT count(*) FROM users WHERE active)::int as users,
      (SELECT to_char(max(finished_at),'DD/MM HH24:MI') FROM sync_runs)::text as last_sync
    `);
    const row = r.rows[0];
    stats = { vehicles: row.vehicles, published: row.published, leads: row.leads, leadsToday: row.leads_today, banners: row.banners, users: row.users, lastSync: row.last_sync || "Nunca" };
  } catch {}

  // Resumo multiorigem. Se a migration 012 ainda não rodou, os cards somem em
  // vez de derrubar o dashboard inteiro.
  let origin: OriginStatsRow | null = null;
  try {
    const r = await query<OriginStatsRow>(`SELECT
      (SELECT count(*) FROM vehicles WHERE origin_type='OWN' AND status='published')::int as own,
      (SELECT count(*) FROM vehicles WHERE origin_type='PARTNER' AND status='published')::int as partner,
      (SELECT count(*) FROM vehicles WHERE origin_type='PRIVATE' AND status='published')::int as private,
      (SELECT count(*) FROM partners WHERE active)::int as active_partners,
      (SELECT count(*) FROM vehicles WHERE created_at >= CURRENT_DATE)::int as new_today,
      (SELECT count(*) FROM vehicle_price_history WHERE created_at >= CURRENT_DATE)::int as price_changed,
      (SELECT count(*) FROM vehicles WHERE availability_status <> 'DISPONIVEL')::int as unavailable
    `);
    origin = r.rows[0] ?? null;
  } catch {}

  let recentVehicles: RecentVehicleRow[] = [];
  let recentLeads: RecentLeadRow[] = [];
  try {
    recentVehicles = (await query<RecentVehicleRow>("SELECT id,title,status,price_cents,image_url,updated_at FROM vehicles ORDER BY updated_at DESC LIMIT 5")).rows;
    recentLeads = (await query<RecentLeadRow>("SELECT id,name,phone,kind,status,created_at FROM leads ORDER BY created_at DESC LIMIT 5")).rows;
  } catch {}

  return (
    <>
      <div className="adm-header">
        <h1>Dashboard</h1>
        <div className="adm-header-actions">
          <span className="adm-sync-status">🔄 Última sync: {stats.lastSync}</span>
        </div>
      </div>
      <div className="adm-stats">
        <div className="adm-stat"><span className="adm-stat-icon">🚗</span><div><strong>{stats.published}</strong><span>Veículos ativos</span></div></div>
        <div className="adm-stat"><span className="adm-stat-icon">📦</span><div><strong>{stats.vehicles}</strong><span>Total no estoque</span></div></div>
        <div className="adm-stat"><span className="adm-stat-icon">📋</span><div><strong>{stats.leadsToday}</strong><span>Leads hoje</span></div></div>
        <div className="adm-stat"><span className="adm-stat-icon">📨</span><div><strong>{stats.leads}</strong><span>Total de leads</span></div></div>
        <div className="adm-stat"><span className="adm-stat-icon">🖼️</span><div><strong>{stats.banners}</strong><span>Banners ativos</span></div></div>
        <div className="adm-stat"><span className="adm-stat-icon">👥</span><div><strong>{stats.users}</strong><span>Usuários</span></div></div>
      </div>
      {origin && (
        <>
          <h2 className="adm-section-title">Estoque por origem</h2>
          <div className="adm-stats">
            <div className="adm-stat"><span className="adm-stat-icon">🏠</span><div><strong>{origin.own}</strong><span>Estoque próprio</span></div></div>
            <div className="adm-stat"><span className="adm-stat-icon">🤝</span><div><strong>{origin.partner}</strong><span>Lojas parceiras</span></div></div>
            <div className="adm-stat"><span className="adm-stat-icon">👤</span><div><strong>{origin.private}</strong><span>Venda particular</span></div></div>
            <div className="adm-stat"><span className="adm-stat-icon">🔗</span><div><strong>{origin.active_partners}</strong><span>Parceiros ativos</span></div></div>
            <div className="adm-stat"><span className="adm-stat-icon">🆕</span><div><strong>{origin.new_today}</strong><span>Novos hoje</span></div></div>
            <div className="adm-stat"><span className="adm-stat-icon">💲</span><div><strong>{origin.price_changed}</strong><span>Preços alterados hoje</span></div></div>
            <div className="adm-stat"><span className="adm-stat-icon">⚠️</span><div><strong>{origin.unavailable}</strong><span>Possivelmente indisponíveis</span></div></div>
          </div>
        </>
      )}
      <div className="adm-grid-2">
        <div className="adm-card">
          <div className="adm-card-header"><h2>Veículos recentes</h2><Link href="/admin/veiculos" className="adm-link">Ver todos →</Link></div>
          <table className="adm-table"><thead><tr><th>Foto</th><th>Veículo</th><th>Status</th><th>Preço</th></tr></thead><tbody>
            {recentVehicles.map((v) => (
              <tr key={v.id}><td><img src={v.image_url || "/em-breve.jpg"} alt="" className="adm-thumb" /></td><td>{v.title}</td><td><span className={`adm-badge ${v.status}`}>{v.status}</span></td><td>{(v.price_cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</td></tr>
            ))}
          </tbody></table>
        </div>
        <div className="adm-card">
          <div className="adm-card-header"><h2>Leads recentes</h2><Link href="/admin/leads" className="adm-link">Ver todos →</Link></div>
          <table className="adm-table"><thead><tr><th>Nome</th><th>Telefone</th><th>Tipo</th><th>Status</th></tr></thead><tbody>
            {recentLeads.map((l) => (
              <tr key={l.id}><td>{l.name}</td><td>{l.phone}</td><td>{l.kind}</td><td><span className={`adm-badge ${l.status}`}>{l.status}</span></td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </>
  );
}
