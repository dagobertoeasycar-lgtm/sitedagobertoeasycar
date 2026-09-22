import { redirect } from "next/navigation";
import Link from "next/link";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { brl, km, ORIGIN_LABELS, shortTime } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

type Summary = {
  published: number;
  available: number;
  reserved: number;
  sold: number;
  maybe_gone: number;
  gone: number;
  no_photo: number;
  value_cents: number;
  avg_days: number | null;
};
type PartnerRow = { id: string; name: string; published: number; maybe_gone: number; last_sync_at: Date | null; last_error: string | null };
type AttentionRow = { id: string; title: string; internal_code: string | null; price_cents: number; mileage: number; reason: string; since: Date };

async function safe<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  try {
    return (await query<T>(sql)).rows;
  } catch {
    return [];
  }
}

export default async function StockPage() {
  if (!(await currentSession())) redirect("/admin/login");

  const [summaryRows, partners, attention] = await Promise.all([
    safe<Summary>(`select
      count(*) filter (where status='published')::int as published,
      count(*) filter (where status='published' and stock_status='available')::int as available,
      count(*) filter (where status='published' and stock_status='reserved')::int as reserved,
      count(*) filter (where stock_status='sold' or status='sold')::int as sold,
      count(*) filter (where availability_status='POSSIVELMENTE_INDISPONIVEL')::int as maybe_gone,
      count(*) filter (where availability_status='INDISPONIVEL')::int as gone,
      count(*) filter (where status='published' and coalesce(image_url,'')='')::int as no_photo,
      coalesce(sum(price_cents) filter (where status='published' and stock_status<>'sold'),0)::bigint as value_cents,
      round(avg(extract(epoch from now()-created_at)/86400) filter (where status='published'))::int as avg_days
      from vehicles`),
    safe<PartnerRow>(`select p.id, coalesce(nullif(p.trade_name,''), p.name) as name,
      count(v.id) filter (where v.status='published')::int as published,
      count(v.id) filter (where v.availability_status='POSSIVELMENTE_INDISPONIVEL')::int as maybe_gone,
      p.last_sync_at, p.last_error
      from partners p left join vehicles v on v.partner_id = p.id
      where p.active group by p.id having count(v.id) > 0 order by published desc`),
    safe<AttentionRow>(`select id, title, internal_code, price_cents, mileage,
        case when availability_status='POSSIVELMENTE_INDISPONIVEL' then 'Sumiu da fonte na última leitura'
             when coalesce(image_url,'')='' then 'Publicado sem foto'
             else 'Reservado' end as reason,
        updated_at as since
      from vehicles
      where status='published' and (availability_status='POSSIVELMENTE_INDISPONIVEL' or coalesce(image_url,'')='' or stock_status='reserved')
      order by updated_at desc limit 40`),
  ]);
  const s = summaryRows[0];

  const cards = s ? [
    { label: "Publicados", value: s.published.toLocaleString("pt-BR"), href: "/admin/veiculos?status=published" },
    { label: "Disponíveis", value: s.available.toLocaleString("pt-BR"), href: "/admin/veiculos?status=published" },
    { label: "Reservados", value: s.reserved.toLocaleString("pt-BR"), href: "/admin/veiculos?status=reserved" },
    { label: "Vendidos", value: s.sold.toLocaleString("pt-BR"), href: "/admin/veiculos?status=sold" },
    { label: "Possivelmente indisponíveis", value: s.maybe_gone.toLocaleString("pt-BR") },
    { label: "Publicados sem foto", value: s.no_photo.toLocaleString("pt-BR") },
    { label: "Valor do estoque publicado", value: brl(Number(s.value_cents)) },
    { label: "Tempo médio no ar", value: s.avg_days === null ? "—" : `${s.avg_days} dias` },
  ] : [];

  return (
    <>
      <div className="adm-header"><h1>Estoque</h1></div>

      <div className="ad-mini-cards">
        {cards.map((card) => {
          const body = <><span>{card.label}</span><strong>{card.value}</strong></>;
          return card.href
            ? <Link key={card.label} href={card.href} className="ad-mini-card">{body}</Link>
            : <div key={card.label} className="ad-mini-card">{body}</div>;
        })}
      </div>

      <div className="ad-grid-2">
        <section className="adm-card">
          <div className="adm-card-header"><h2>Precisa de atenção</h2></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Veículo</th><th>Preço</th><th>Km</th><th>Motivo</th><th>Desde</th></tr></thead>
              <tbody>
                {attention.map((v) => (
                  <tr key={v.id}>
                    <td><Link href={`/admin/veiculos/${v.id}`} className="ad-row-title">{v.title}</Link>{v.internal_code && <><br /><small>#{v.internal_code}</small></>}</td>
                    <td>{brl(v.price_cents)}</td>
                    <td>{km(v.mileage)}</td>
                    <td>{v.reason}</td>
                    <td>{shortTime(v.since)}</td>
                  </tr>
                ))}
                {!attention.length && <tr><td colSpan={5} className="adm-empty-row">Nada pendente no estoque.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card-header"><h2>Estoque por fonte</h2><Link href="/admin/parceiros" className="adm-link">Fontes →</Link></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Fonte</th><th>Publicados</th><th>A conferir</th><th>Última leitura</th><th>Situação</th></tr></thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.published}</td>
                    <td>{p.maybe_gone || "—"}</td>
                    <td>{p.last_sync_at ? shortTime(p.last_sync_at) : "Manual"}</td>
                    <td>{p.last_error ? <span className="adm-badge draft" title={p.last_error}>Com erro</span> : <span className="adm-badge published">OK</span>}</td>
                  </tr>
                ))}
                {!partners.length && <tr><td colSpan={5} className="adm-empty-row">{ORIGIN_LABELS.OWN} apenas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
