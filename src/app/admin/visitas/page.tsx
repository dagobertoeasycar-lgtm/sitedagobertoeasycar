import Link from "next/link";
import { requireArea } from "@/lib/permissions";
import { query } from "@/lib/db";
import { AdminBars, type BarItem } from "@/components/AdminBars";
import { LEAD_KIND_LABELS } from "@/lib/admin-labels";
import { SECTION_LABELS, SERVICE_SECTIONS, SOURCE_LABELS } from "@/lib/site-analytics";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, { label: string; interval: string; days: number }> = {
  hoje: { label: "Hoje", interval: "0 days", days: 1 },
  "7": { label: "7 dias", interval: "6 days", days: 7 },
  "30": { label: "30 dias", interval: "29 days", days: 30 },
  "90": { label: "90 dias", interval: "89 days", days: 90 },
};

// Objeto com chaves numéricas perde a ordem de declaração; a ordem das abas fica explícita.
const PERIOD_ORDER = ["hoje", "7", "30", "90"];

// Período sempre em dias corridos no fuso de São Paulo, começando à meia-noite.
const SINCE = "(date_trunc('day', now() at time zone 'America/Sao_Paulo') - $1::interval) at time zone 'America/Sao_Paulo'";

type Totals = { views: number; visitors: number; sessions: number; new_visitors: number; whatsapp: number; forms: number };
type DayRow = { day: string; label: string; views: number; visitors: number };
type VehicleRow = { slug: string; title: string; views: number; visitors: number; leads: number; price_cents: number | null };
type ServiceRow = { section: string; views: number; visitors: number };

async function bars(sql: string, params: unknown[]): Promise<BarItem[]> {
  return query<BarItem>(sql, params).then((r) => r.rows).catch(() => []);
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${((part / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

// Serviço do site ↔ tipo de lead gerado por ele.
const SERVICE_LEAD_KINDS: Record<string, string[]> = {
  financiamento: ["financing"],
  "financia-facil": ["financing_private"],
  "venda-seu-carro": ["sell_car"],
  "encontre-seu-carro": ["find_car"],
  atacado: ["wholesale"],
  parceiros: ["partner"],
  contato: ["contact"],
};

export default async function VisitsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireArea("relatorios");
  const sp = await searchParams;
  const key = PERIODS[sp.periodo] ? sp.periodo : "30";
  const period = PERIODS[key];
  const p = [period.interval];

  const [totals, online, leadTotal, perDay, cities, states, sources, devices, vehicles, brands, services, leadsByKind, searches, pages, campaigns, hours] = await Promise.all([
    query<Totals>(`select count(*) filter (where event='pageview')::int as views,
        count(distinct visitor_id) filter (where event='pageview')::int as visitors,
        count(distinct session_id) filter (where event='pageview')::int as sessions,
        count(*) filter (where event='pageview' and is_new_visitor)::int as new_visitors,
        count(*) filter (where event='whatsapp_click')::int as whatsapp,
        count(*) filter (where event='form_open')::int as forms
      from site_events where created_at >= ${SINCE}`, p).then((r) => r.rows[0]).catch(() => undefined),
    query<{ total: number }>("select count(distinct visitor_id)::int as total from site_events where created_at >= now() - interval '5 minutes'").then((r) => r.rows[0]?.total ?? 0).catch(() => 0),
    query<{ total: number }>(`select count(*)::int as total from leads where created_at >= ${SINCE}`, p).then((r) => r.rows[0]?.total ?? 0).catch(() => 0),
    query<DayRow>(`select to_char(d, 'YYYY-MM-DD') as day, to_char(d, 'DD/MM') as label,
        count(e.id) filter (where e.event='pageview')::int as views,
        count(distinct e.visitor_id) filter (where e.event='pageview')::int as visitors
      from generate_series(date_trunc('day', now() at time zone 'America/Sao_Paulo') - $1::interval, date_trunc('day', now() at time zone 'America/Sao_Paulo'), interval '1 day') d
      left join site_events e on e.created_at >= ${SINCE} and (e.created_at at time zone 'America/Sao_Paulo') >= d and (e.created_at at time zone 'America/Sao_Paulo') < d + interval '1 day'
      group by d order by d`, p).then((r) => r.rows).catch(() => []),
    bars(`select coalesce(city, 'Não identificada') || coalesce(' / ' || region, '') as label, count(distinct visitor_id)::int as total
      from site_events where event='pageview' and created_at >= ${SINCE} group by 1 order by total desc limit 10`, p),
    bars(`select coalesce(region, 'Não identificado') || case when country is not null and country <> 'BR' then ' (' || country || ')' else '' end as label,
        count(distinct visitor_id)::int as total
      from site_events where event='pageview' and created_at >= ${SINCE} group by 1 order by total desc limit 10`, p),
    bars(`select source as label, count(distinct session_id)::int as total from site_events
      where event='pageview' and source <> 'interno' and created_at >= ${SINCE} group by source order by total desc`, p),
    bars(`select device as label, count(distinct visitor_id)::int as total from site_events
      where event='pageview' and created_at >= ${SINCE} group by device order by total desc`, p),
    query<VehicleRow>(`with views as (
        select vehicle_slug as slug, count(*)::int as views, count(distinct visitor_id)::int as visitors
        from site_events where event='pageview' and vehicle_slug is not null and created_at >= ${SINCE} group by vehicle_slug
      )
      select v.slug, coalesce(ve.title, v.slug) as title, v.views, v.visitors, ve.price_cents,
        (select count(*)::int from leads l where l.vehicle_id = ve.id and l.created_at >= ${SINCE}) as leads
      from views v left join vehicles ve on ve.slug = v.slug order by v.views desc limit 15`, p).then((r) => r.rows).catch(() => []),
    bars(`select coalesce(nullif(ve.brand, ''), 'Outras') as label, count(distinct e.visitor_id)::int as total
      from site_events e join vehicles ve on ve.slug = e.vehicle_slug
      where e.event='pageview' and e.created_at >= ${SINCE} group by 1 order by total desc limit 10`, p),
    query<ServiceRow>(`select section, count(*)::int as views, count(distinct visitor_id)::int as visitors from site_events
      where event='pageview' and section = any($2) and created_at >= ${SINCE} group by section order by visitors desc`, [period.interval, SERVICE_SECTIONS]).then((r) => r.rows).catch(() => []),
    query<{ kind: string; total: number }>(`select case when kind='financing' and payload->>'financingService'='private' then 'financing_private' else kind end as kind,
        count(*)::int as total from leads where created_at >= ${SINCE} group by 1 order by total desc`, p).then((r) => r.rows).catch(() => []),
    bars(`select search_query as label, count(*)::int as total from site_events
      where event='pageview' and search_query is not null and created_at >= ${SINCE} group by 1 order by total desc limit 10`, p),
    bars(`select section as label, count(*)::int as total from site_events
      where event='pageview' and created_at >= ${SINCE} group by section order by total desc limit 12`, p),
    bars(`select utm_campaign as label, count(distinct session_id)::int as total from site_events
      where event='pageview' and utm_campaign is not null and created_at >= ${SINCE} group by 1 order by total desc limit 8`, p),
    bars(`select lpad(extract(hour from created_at at time zone 'America/Sao_Paulo')::int::text, 2, '0') || 'h' as label, count(*)::int as total
      from site_events where event='pageview' and created_at >= ${SINCE} group by 1 order by 1`, p),
  ]);

  const t = totals ?? { views: 0, visitors: 0, sessions: 0, new_visitors: 0, whatsapp: 0, forms: 0 };
  const leadsByKindMap = Object.fromEntries(leadsByKind.map((row) => [row.kind, row.total]));
  const maxDay = Math.max(1, ...perDay.map((d) => d.visitors));
  const noData = t.views === 0;

  return (
    <>
      <div className="adm-header">
        <h1>Central de visitas</h1>
        <div className="ad-tabs" style={{ marginBottom: 0 }}>
          {PERIOD_ORDER.map((value) => [value, PERIODS[value]] as const).map(([value, item]) => (
            <Link key={value} href={`/admin/visitas?periodo=${value}`} className={`ad-tab-link${value === key ? " active" : ""}`}>{item.label}</Link>
          ))}
        </div>
      </div>
      <p className="adm-header-description">
        <span className="ad-live-dot" aria-hidden="true" /> <b>{online}</b> {online === 1 ? "pessoa navegando" : "pessoas navegando"} agora ·
        Contagem própria do site, anônima (sem IP), sem contar robôs nem a equipe logada no painel.
      </p>

      {noData && <p className="adm-feedback">Ainda não há visitas registradas neste período. A contagem começa a partir da publicação desta versão do site.</p>}

      <div className="ad-mini-cards ad-mini-cards-6">
        <div className="ad-mini-card"><span>Visitantes</span><strong>{t.visitors.toLocaleString("pt-BR")}</strong><small>{t.new_visitors.toLocaleString("pt-BR")} novos</small></div>
        <div className="ad-mini-card"><span>Visitas (sessões)</span><strong>{t.sessions.toLocaleString("pt-BR")}</strong></div>
        <div className="ad-mini-card"><span>Páginas vistas</span><strong>{t.views.toLocaleString("pt-BR")}</strong><small>{t.sessions ? (t.views / t.sessions).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0} por visita</small></div>
        <div className="ad-mini-card"><span>Leads recebidos</span><strong>{leadTotal.toLocaleString("pt-BR")}</strong><small>{pct(leadTotal, t.visitors)} dos visitantes</small></div>
        <div className="ad-mini-card"><span>Cliques no WhatsApp</span><strong>{t.whatsapp.toLocaleString("pt-BR")}</strong></div>
        <div className="ad-mini-card"><span>Formulários abertos</span><strong>{t.forms.toLocaleString("pt-BR")}</strong><small>no anúncio do veículo</small></div>
      </div>

      <section className="adm-card">
        <div className="adm-card-header"><h2>Visitantes por dia</h2><span className="ad-note">passe o mouse para ver os números</span></div>
        <div className="ad-cols" role="img" aria-label="Visitantes únicos por dia no período">
          {perDay.map((d) => (
            <div key={d.day} className="ad-col" tabIndex={0}>
              <span className="ad-col-bar" style={{ height: `${Math.max(d.visitors ? 3 : 0, (d.visitors / maxDay) * 100)}%` }} />
              <span className="ad-col-tip"><b>{d.label}</b>{d.visitors} visitantes · {d.views} páginas</span>
              {(perDay.length <= 31 || Number(d.day.slice(8)) % 5 === 1) && <span className="ad-col-label">{perDay.length > 14 ? d.label.slice(0, 2) : d.label}</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="ad-grid-2">
        <section className="adm-card"><div className="adm-card-header"><h2>Cidades que mais visitam</h2></div><AdminBars items={cities} wide /></section>
        <section className="adm-card"><div className="adm-card-header"><h2>Estados</h2></div><AdminBars items={states} wide /></section>
        <section className="adm-card">
          <div className="adm-card-header"><h2>De onde vêm as visitas</h2></div>
          <AdminBars items={sources.map((row) => ({ ...row, label: SOURCE_LABELS[row.label] ?? row.label }))} wide />
        </section>
        <section className="adm-card">
          <div className="adm-card-header"><h2>Dispositivos</h2></div>
          <AdminBars items={devices.map((row) => ({ ...row, label: row.label.charAt(0).toUpperCase() + row.label.slice(1) }))} wide />
          {campaigns.length > 0 && <><h3 className="adm-section-title" style={{ marginTop: 16 }}>Campanhas (utm_campaign)</h3><AdminBars items={campaigns} wide /></>}
        </section>
      </div>

      <section className="adm-card">
        <div className="adm-card-header"><h2>Carros mais procurados</h2><Link href="/admin/relatorios" className="adm-link">Relatórios de leads →</Link></div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>#</th><th>Veículo</th><th>Visualizações</th><th>Pessoas</th><th>Leads</th><th>Conversão</th></tr></thead>
            <tbody>
              {vehicles.map((v, i) => (
                <tr key={v.slug}>
                  <td>{i + 1}</td>
                  <td><a href={`/veiculos/${v.slug}`} target="_blank" rel="noreferrer" className="ad-row-title">{v.title}</a></td>
                  <td>{v.views.toLocaleString("pt-BR")}</td>
                  <td>{v.visitors.toLocaleString("pt-BR")}</td>
                  <td>{v.leads}</td>
                  <td>{pct(v.leads, v.visitors)}</td>
                </tr>
              ))}
              {!vehicles.length && <tr><td colSpan={6} className="adm-empty-row">Sem visualizações de anúncios no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="ad-grid-2">
        <section className="adm-card"><div className="adm-card-header"><h2>Marcas mais procuradas</h2></div><AdminBars items={brands} wide /></section>
        <section className="adm-card">
          <div className="adm-card-header"><h2>Serviços mais procurados</h2></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Serviço</th><th>Pessoas</th><th>Leads</th><th>Conversão</th></tr></thead>
              <tbody>
                {SERVICE_SECTIONS.map((section) => {
                  const row = services.find((s) => s.section === section);
                  const leads = (SERVICE_LEAD_KINDS[section] ?? []).reduce((sum, kind) => sum + (leadsByKindMap[kind] ?? 0), 0);
                  return { section, visitors: row?.visitors ?? 0, leads };
                }).sort((a, b) => b.visitors - a.visitors || b.leads - a.leads).map((row) => (
                  <tr key={row.section}>
                    <td>{SECTION_LABELS[row.section]}</td>
                    <td>{row.visitors.toLocaleString("pt-BR")}</td>
                    <td>{row.leads}</td>
                    <td>{pct(row.leads, row.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ad-note">Financiamento soma as simulações feitas nos anúncios e nas páginas de financiamento.</p>
        </section>
        <section className="adm-card">
          <div className="adm-card-header"><h2>Leads por tipo</h2></div>
          <AdminBars items={leadsByKind.map((row) => ({ label: row.kind === "financing_private" ? "Financia Fácil" : LEAD_KIND_LABELS[row.kind] ?? row.kind, total: row.total }))} wide />
        </section>
        <section className="adm-card"><div className="adm-card-header"><h2>O que mais pesquisam no estoque</h2></div><AdminBars items={searches} wide /></section>
        <section className="adm-card">
          <div className="adm-card-header"><h2>Páginas mais vistas</h2></div>
          <AdminBars items={pages.map((row) => ({ ...row, label: SECTION_LABELS[row.label] ?? row.label }))} wide />
        </section>
        <section className="adm-card"><div className="adm-card-header"><h2>Horários de maior movimento</h2></div><AdminBars items={hours} /></section>
      </div>
    </>
  );
}
