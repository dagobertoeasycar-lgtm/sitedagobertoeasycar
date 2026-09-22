import Link from "next/link";
import { requireArea } from "@/lib/permissions";
import { query } from "@/lib/db";
import { AdminBars, type BarItem } from "@/components/AdminBars";
import { brl, LEAD_KIND_LABELS, ORIGIN_LABELS } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

const PERIODS: Record<string, [string, string]> = {
  "7": ["7 dias", "7 days"],
  "30": ["30 dias", "30 days"],
  "90": ["90 dias", "90 days"],
};

async function bars(sql: string, params: unknown[] = []): Promise<BarItem[]> {
  return query<BarItem>(sql, params).then((r) => r.rows).catch(() => []);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireArea("relatorios");
  const sp = await searchParams;
  const days = PERIODS[sp.dias] ? sp.dias : "30";
  const interval = PERIODS[days][1];

  const [leadTotals, byKind, bySource, topVehicles, perDay, byBrand, byPrice, stockAge, priceChanges] = await Promise.all([
    query<{ total: number; converted: number; lost: number }>(
      `select count(*)::int as total, count(*) filter (where status='converted')::int as converted,
       count(*) filter (where status='lost')::int as lost from leads where created_at >= now() - interval '${interval}'`,
    ).then((r) => r.rows[0]).catch(() => undefined),
    bars(`select kind as label, count(*)::int as total from leads where created_at >= now() - interval '${interval}' group by kind order by total desc`),
    bars(`select coalesce(nullif(utm_source,''), nullif(lead_source,''), 'site') as label, count(*)::int as total
      from leads where created_at >= now() - interval '${interval}' group by 1 order by total desc limit 8`),
    bars(`select v.title as label, count(*)::int as total from leads l join vehicles v on v.id = l.vehicle_id
      where l.created_at >= now() - interval '${interval}' group by v.title order by total desc limit 10`),
    bars(`select to_char(d, 'DD/MM') as label, coalesce(count(l.id), 0)::int as total
      from generate_series(current_date - (interval '${interval}' - interval '1 day'), current_date, interval '1 day') d
      left join leads l on l.created_at >= d and l.created_at < d + interval '1 day'
      group by d order by d desc limit 14`),
    bars(`select brand as label, count(*)::int as total from vehicles where status='published' and coalesce(brand,'')<>''
      group by brand order by total desc limit 10`),
    bars(`select case when price_cents < 5000000 then 'Até R$ 50 mil' when price_cents < 8000000 then 'R$ 50 a 80 mil'
        when price_cents < 12000000 then 'R$ 80 a 120 mil' when price_cents < 20000000 then 'R$ 120 a 200 mil' else 'Acima de R$ 200 mil' end as label,
        count(*)::int as total, min(price_cents) as ordem
      from vehicles where status='published' group by 1 order by ordem`),
    bars(`select origin_type as label, round(avg(extract(epoch from now()-created_at)/86400))::int as total
      from vehicles where status='published' group by origin_type order by total desc`),
    query<{ changes: number; down: number; up: number }>(
      `select count(*)::int as changes,
        count(*) filter (where new_published_price_cents < previous_published_price_cents)::int as down,
        count(*) filter (where new_published_price_cents > previous_published_price_cents)::int as up
       from vehicle_price_history where created_at >= now() - interval '${interval}'`,
    ).then((r) => r.rows[0]).catch(() => undefined),
  ]);

  const conversion = leadTotals?.total ? Math.round((leadTotals.converted / leadTotals.total) * 100) : 0;

  return (
    <>
      <div className="adm-header">
        <h1>Relatórios / inteligência</h1>
        <div className="ad-tabs" style={{ marginBottom: 0 }}>
          {Object.entries(PERIODS).map(([value, [label]]) => (
            <Link key={value} href={`/admin/relatorios?dias=${value}`} className={`ad-tab-link${value === days ? " active" : ""}`}>{label}</Link>
          ))}
        </div>
      </div>

      <div className="ad-mini-cards">
        <div className="ad-mini-card"><span>Leads no período</span><strong>{(leadTotals?.total ?? 0).toLocaleString("pt-BR")}</strong></div>
        <div className="ad-mini-card"><span>Convertidos</span><strong>{leadTotals?.converted ?? 0}</strong><small>{conversion}% de conversão</small></div>
        <div className="ad-mini-card"><span>Mudanças de preço</span><strong>{priceChanges?.changes ?? 0}</strong><small>{priceChanges?.down ?? 0} baixaram · {priceChanges?.up ?? 0} subiram</small></div>
        <div className="ad-mini-card"><span>Perdidos</span><strong>{leadTotals?.lost ?? 0}</strong></div>
      </div>

      <div className="ad-grid-2">
        <section className="adm-card"><div className="adm-card-header"><h2>Leads por dia</h2></div><AdminBars items={perDay} /></section>
        <section className="adm-card"><div className="adm-card-header"><h2>Veículos com mais leads</h2></div><AdminBars items={topVehicles} /></section>
        <section className="adm-card"><div className="adm-card-header"><h2>Leads por tipo</h2></div><AdminBars items={byKind.map((row) => ({ ...row, label: LEAD_KIND_LABELS[row.label] ?? row.label }))} /></section>
        <section className="adm-card"><div className="adm-card-header"><h2>Leads por origem</h2></div><AdminBars items={bySource} /></section>
        <section className="adm-card"><div className="adm-card-header"><h2>Estoque publicado por marca</h2></div><AdminBars items={byBrand} /></section>
        <section className="adm-card"><div className="adm-card-header"><h2>Estoque por faixa de preço</h2></div><AdminBars items={byPrice.map(({ label, total }) => ({ label, total }))} /></section>
        <section className="adm-card">
          <div className="adm-card-header"><h2>Tempo médio no ar (dias)</h2></div>
          <AdminBars items={stockAge.map((row) => ({ ...row, label: ORIGIN_LABELS[row.label] ?? row.label }))} format={(value) => `${value} d`} />
        </section>
        <section className="adm-card">
          <div className="adm-card-header"><h2>Como ler</h2></div>
          <p className="ad-note">
            Leads contam todos os formulários do site no período escolhido. Conversão usa o status “Convertido” marcado no
            atendimento. Valores de estoque consideram só anúncios publicados; o preço médio publicado hoje é{" "}
            <strong>{brl(await query<{ avg: number }>("select avg(price_cents)::int as avg from vehicles where status='published'").then((r) => r.rows[0]?.avg ?? 0).catch(() => 0))}</strong>.
          </p>
        </section>
      </div>
    </>
  );
}
