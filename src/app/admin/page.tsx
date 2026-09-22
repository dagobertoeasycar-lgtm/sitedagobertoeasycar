import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { requireArea } from "@/lib/permissions";
import { query } from "@/lib/db";
import { AdminBars } from "@/components/AdminBars";
import { brl, km, LEAD_KIND_LABELS, LEAD_STATUS_LABELS, ORIGIN_LABELS, shortTime, vehicleBadge } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

type RecentVehicleRow = {
  id: string;
  slug: string;
  internal_code: string | null;
  title: string;
  status: string;
  stock_status: string;
  promotion: boolean;
  origin_type: string;
  price_cents: number;
  mileage: number;
  year_make: number;
  year_model: number;
  image_url: string | null;
};

type RecentLeadRow = { id: string; name: string; phone: string; kind: string; status: string; vehicle_title: string | null; created_at: Date };
type CountRow = { label: string; total: number };
type SourceRow = { name: string; connector: string; last_sync_at: Date | null; last_error: string | null; last_found: number | null };

async function rows<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  try {
    return (await query<T>(sql)).rows;
  } catch {
    return [];
  }
}

export default async function AdminDashboard() {
  await requireArea("dashboard");

  const [recentVehicles, recentLeads, topModels, byOrigin, sources] = await Promise.all([
    rows<RecentVehicleRow>(`select id, slug, internal_code, title, status, stock_status, promotion, origin_type, price_cents, mileage, year_make, year_model, image_url
      from vehicles order by updated_at desc limit 8`),
    rows<RecentLeadRow>(`select l.id, l.name, l.phone, l.kind, l.status, v.title as vehicle_title, l.created_at
      from leads l left join vehicles v on v.id = l.vehicle_id order by l.created_at desc limit 6`),
    rows<CountRow>(`select model as label, count(*)::int as total from vehicles
      where status='published' and coalesce(model,'') <> '' group by model order by total desc, model limit 6`),
    rows<CountRow>(`select origin_type as label, count(*)::int as total from vehicles
      where status='published' group by origin_type order by total desc`),
    rows<SourceRow>(`select coalesce(nullif(trade_name,''), name) as name, connector, last_sync_at, last_error, last_found
      from partners where active and connector is not null order by name`),
  ]);

  return (
    <>
      <div className="adm-header">
        <h1>Dashboard</h1>
        <Link href="/admin/veiculos/novo" className="ad-btn"><Plus size={16} aria-hidden />Novo anúncio</Link>
      </div>

      <div className="ad-grid-main">
        <section className="adm-card">
          <div className="adm-card-header"><h2>Anúncios atualizados recentemente</h2><Link href="/admin/veiculos" className="adm-link">Ver todos →</Link></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Foto</th><th>Código</th><th>Título</th><th>Ano</th><th>Km</th><th>Preço</th><th>Status</th><th>Origem</th><th>Ações</th></tr></thead>
              <tbody>
                {recentVehicles.map((v) => {
                  const badge = vehicleBadge(v.status, v.stock_status, v.promotion);
                  return (
                    <tr key={v.id}>
                      <td><img src={v.image_url || "/em-breve.png"} alt="" className="adm-thumb" /></td>
                      <td><small>{v.internal_code ? `#${v.internal_code}` : "—"}</small></td>
                      <td>{v.title}</td>
                      <td>{v.year_make}/{v.year_model}</td>
                      <td>{km(v.mileage)}</td>
                      <td>{brl(v.price_cents)}</td>
                      <td><span className={`adm-badge ${badge.cls}`}>{badge.label}</span></td>
                      <td>{ORIGIN_LABELS[v.origin_type] ?? v.origin_type}</td>
                      <td>
                        <div className="ad-icon-actions">
                          <a className="ad-icon-btn" href={`/veiculos/${v.slug}`} target="_blank" rel="noreferrer" title="Ver no site" aria-label="Ver no site"><Eye size={15} /></a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!recentVehicles.length && <tr><td colSpan={9} className="adm-empty-row">Nenhum veículo cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <div>
          <section className="adm-card">
            <div className="adm-card-header"><h2>Relatórios / inteligência</h2></div>
            <p className="ad-note" style={{ marginBottom: 10 }}>Modelos com mais anúncios publicados.</p>
            <AdminBars items={topModels} />
          </section>
          <section className="adm-card">
            <div className="adm-card-header"><h2>Estoque por origem</h2></div>
            <AdminBars items={byOrigin.map((row) => ({ ...row, label: ORIGIN_LABELS[row.label] ?? row.label }))} />
          </section>
        </div>
      </div>

      <div className="ad-grid-2">
        <section className="adm-card">
          <div className="adm-card-header"><h2>Leads recentes</h2><Link href="/admin/leads" className="adm-link">Ver todos →</Link></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Nome</th><th>Telefone</th><th>Veículo</th><th>Tipo</th><th>Status</th><th>Data</th></tr></thead>
              <tbody>
                {recentLeads.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>{l.phone}</td>
                    <td>{l.vehicle_title ?? "—"}</td>
                    <td>{LEAD_KIND_LABELS[l.kind] ?? l.kind}</td>
                    <td><span className={`adm-badge ${l.status}`}>{LEAD_STATUS_LABELS[l.status] ?? l.status}</span></td>
                    <td>{shortTime(l.created_at)}</td>
                  </tr>
                ))}
                {!recentLeads.length && <tr><td colSpan={6} className="adm-empty-row">Nenhum lead recebido ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card-header"><h2>Fontes e integrações</h2><Link href="/admin/sync" className="adm-link">Importações →</Link></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Fonte</th><th>Conector</th><th>Veículos</th><th>Última leitura</th><th>Situação</th></tr></thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.name + s.connector}>
                    <td>{s.name}</td>
                    <td><small>{s.connector}</small></td>
                    <td>{s.last_found ?? "—"}</td>
                    <td>{s.last_sync_at ? shortTime(s.last_sync_at) : "—"}</td>
                    <td>{s.last_error ? <span className="adm-badge draft" title={s.last_error}>Com erro</span> : <span className="adm-badge published">Online</span>}</td>
                  </tr>
                ))}
                {!sources.length && <tr><td colSpan={5} className="adm-empty-row">Nenhuma fonte automática configurada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
