import Link from "next/link";
import { query } from "@/lib/db";
import { formatCents } from "@/lib/pricing";
import { FINANCING_SERVICES, resolveFinancingService } from "@/lib/financing";
import { LEAD_KIND_LABELS, LEAD_STATUS_LABELS, ORIGIN_LABELS, shortTime } from "@/lib/admin-labels";
import { LeadNotes, LeadQuickFields } from "@/components/LeadAttendance";
import { getReviewLink } from "@/lib/settings";

/**
 * Tabela de atendimento compartilhada por Leads / Contatos e Financiamentos.
 * O nome do parceiro e a margem aparecem só aqui, no painel — nunca no site.
 */
type Mode = "contacts" | "financing";

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  kind: string;
  payload: Record<string, unknown> | null;
  message: string | null;
  status: string;
  created_at: Date;
  lead_source: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  page_url: string | null;
  assigned_to: string | null;
  notes: string | null;
  vehicle_id: string | null;
  vehicle_title: string | null;
  vehicle_internal_code: string | null;
  vehicle_origin_type: string | null;
  vehicle_origin_price_cents: number | null;
  vehicle_price_cents: number | null;
  partner_name: string | null;
};

// Atacado e parceria têm tela própria (Leads de parceiros).
const CONTACT_KINDS = ["contact", "sell_car", "find_car", "vehicle_interest"];

function sourceLabel(lead: LeadRow) {
  const raw = lead.utm_source || lead.lead_source || "";
  if (/whats/i.test(raw)) return "WhatsApp";
  if (/insta|facebook|meta|fb/i.test(raw)) return "Meta";
  if (/google/i.test(raw)) return "Google";
  return raw || "Site";
}

function payloadLines(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  return Object.entries(payload)
    .filter(([key, value]) => value !== null && value !== "" && typeof value !== "object" && !/consent|token|utm_/i.test(key))
    .slice(0, 24)
    .map(([key, value]) => `${key}: ${String(value)}`);
}

/** Mensagem pronta de pedido de avaliação, já com o link do Google. */
function reviewWhatsappLink(phone: string, name: string, reviewLink: string) {
  const texto = `Oi, ${name.split(" ")[0]}! Aqui é da Autodrive Veículos. Se o atendimento foi bom, você pode deixar sua avaliação no Google? Leva menos de um minuto: ${reviewLink}`;
  return `https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

export async function LeadsView({ mode, searchParams, basePath, extraParams = {} }: { mode: Mode; searchParams: Record<string, string>; basePath: string; extraParams?: Record<string, string> }) {
  const reviewLink = await getReviewLink().catch(() => "");
  const filters = {
    q: searchParams.q || "",
    status: searchParams.status || "",
    kind: searchParams.kind || "",
    owner: searchParams.owner || "",
    period: searchParams.period || "",
  };
  const page = Math.max(1, parseInt(searchParams.p || "1") || 1);
  const limit = 30;

  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replaceAll("?", `$${params.length}`)); };

  if (mode === "financing") conditions.push("l.kind='financing'");
  else if (filters.kind && CONTACT_KINDS.includes(filters.kind)) add("l.kind=?", filters.kind);
  else add("l.kind = any(?)", CONTACT_KINDS);
  if (filters.status) add("l.status=?", filters.status);
  if (filters.period === "today") conditions.push("l.created_at >= current_date");
  if (filters.period === "7d") conditions.push("l.created_at >= now() - interval '7 days'");
  if (filters.period === "30d") conditions.push("l.created_at >= now() - interval '30 days'");
  if (filters.q) add("(l.name ilike ? or l.phone ilike ? or l.email ilike ?)", `%${filters.q}%`);
  const baseWhere = conditions.join(" and ") || "true";
  // Responsável depende da migration 022; sem ela, o filtro é ignorado.
  const ownerWhere = filters.owner === "none" ? " and l.assigned_to is null" : filters.owner ? ` and l.assigned_to=$${params.length + 1}` : "";
  const ownerParams = filters.owner && filters.owner !== "none" ? [filters.owner] : [];

  const select = (withAttendance: boolean) => `select l.id, l.name, l.phone, l.email, l.kind, l.payload, l.message, l.status, l.created_at,
      l.lead_source, l.utm_source, l.utm_campaign, l.page_url,
      ${withAttendance ? "l.assigned_to, l.notes" : "null::uuid as assigned_to, null::text as notes"},
      l.vehicle_id, v.title as vehicle_title, v.internal_code as vehicle_internal_code,
      coalesce(l.vehicle_origin_type, v.origin_type) as vehicle_origin_type,
      v.origin_price_cents as vehicle_origin_price_cents, v.price_cents as vehicle_price_cents, p.name as partner_name
    from leads l
    left join vehicles v on v.id = l.vehicle_id
    left join partners p on p.id = coalesce(l.partner_id, v.partner_id)`;

  let attendance = true;
  let rows: LeadRow[] = [];
  let total = 0;
  try {
    const allParams = [...params, ...ownerParams];
    const [list, count] = await Promise.all([
      query<LeadRow>(`${select(true)} where ${baseWhere}${ownerWhere} order by l.created_at desc limit ${limit} offset ${(page - 1) * limit}`, allParams),
      query<{ total: number }>(`select count(*)::int as total from leads l where ${baseWhere}${ownerWhere}`, allParams),
    ]);
    rows = list.rows;
    total = count.rows[0]?.total ?? 0;
  } catch {
    attendance = false;
    const [list, count] = await Promise.all([
      query<LeadRow>(`${select(false)} where ${baseWhere} order by l.created_at desc limit ${limit} offset ${(page - 1) * limit}`, params),
      query<{ total: number }>(`select count(*)::int as total from leads l where ${baseWhere}`, params),
    ]);
    rows = list.rows;
    total = count.rows[0]?.total ?? 0;
  }

  const users = await query<{ id: string; label: string }>(
    "select id, coalesce(nullif(name,''), email) as label from users where active order by label",
  ).then((r) => r.rows).catch(() =>
    query<{ id: string; label: string }>("select id, email as label from users where active order by email").then((r) => r.rows).catch(() => []),
  );
  const userName = Object.fromEntries(users.map((user) => [user.id, user.label]));

  const totalPages = Math.ceil(total / limit);
  const pageLink = (n: number) => `${basePath}?${new URLSearchParams(Object.entries({ ...extraParams, ...filters, p: String(n) }).filter(([, v]) => v)).toString()}`;
  const active = Object.values(filters).some(Boolean);

  return (
    <section className="adm-card">
      {!attendance && (
        <p className="adm-feedback error">Responsável e anotações ficam disponíveis depois de rodar a migração 022 (npm run db:migrate).</p>
      )}
      <form className="adm-filters" action={basePath}>
        {Object.entries(extraParams).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
        <label>Busca<input name="q" defaultValue={filters.q} placeholder="Nome, telefone ou e-mail" /></label>
        <label>Status
          <select name="status" defaultValue={filters.status}>
            <option value="">Todos</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {mode === "contacts" && (
          <label>Tipo
            <select name="kind" defaultValue={filters.kind}>
              <option value="">Todos</option>
              {CONTACT_KINDS.map((kind) => <option key={kind} value={kind}>{LEAD_KIND_LABELS[kind]}</option>)}
            </select>
          </label>
        )}
        <label>Responsável
          <select name="owner" defaultValue={filters.owner}>
            <option value="">Todos</option>
            <option value="none">Sem responsável</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
          </select>
        </label>
        <label>Período
          <select name="period" defaultValue={filters.period}>
            <option value="">Todo o período</option>
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </label>
        <button className="ad-btn ghost">Filtrar</button>
        {active && <Link href={`${basePath}${Object.keys(extraParams).length ? `?${new URLSearchParams(extraParams)}` : ""}`} className="adm-link">Limpar</Link>}
        <span className="ad-push-right ad-total">{total.toLocaleString("pt-BR")} registro(s)</span>
      </form>

      <div className="adm-table-wrap">
        <table className="adm-table ad-leads">
          <thead><tr><th>Nome</th><th>Telefone</th><th>Veículo</th><th>{mode === "financing" ? "Serviço" : "Tipo"}</th><th>Origem</th><th>Status / responsável</th><th>Data</th></tr></thead>
          <tbody>
            {rows.map((lead) => {
              const service = mode === "financing" ? resolveFinancingService(lead.payload?.financingService, lead.payload?.financingTarget) : null;
              const details = payloadLines(lead.payload);
              return (
                <tr key={lead.id}>
                  <td>
                    <details className="ad-lead-details">
                      <summary><strong>{lead.name}</strong></summary>
                      <div>
                        {lead.email && <p><b>E-mail:</b> <a href={`mailto:${lead.email}`}>{lead.email}</a></p>}
                        {lead.message && <p className="ad-pre">{lead.message}</p>}
                        {details.length > 0 && <ul>{details.map((line) => <li key={line}>{line}</li>)}</ul>}
                        {lead.page_url && <p><b>Página:</b> {lead.page_url}</p>}
                        {lead.utm_campaign && <p><b>Campanha:</b> {lead.utm_campaign}</p>}
                        <p><Link href={`/admin/leads?abrir=${lead.id}`} className="adm-link">Abrir ficha completa no CRM →</Link></p>
                        {attendance && <LeadNotes id={lead.id} notes={lead.notes} />}
                      </div>
                    </details>
                  </td>
                  <td>
                    <a href={`https://wa.me/55${lead.phone?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{lead.phone}</a>
                    {reviewLink && lead.phone && (
                      <><br /><a className="ad-review-link" href={reviewWhatsappLink(lead.phone, lead.name, reviewLink)} target="_blank" rel="noreferrer">★ Pedir avaliação</a></>
                    )}
                  </td>
                  <td className="adm-lead-origin">
                    {lead.vehicle_title ? (
                      <>
                        {lead.vehicle_id ? <Link href={`/admin/veiculos/${lead.vehicle_id}`} className="ad-row-title">{lead.vehicle_title}</Link> : <strong>{lead.vehicle_title}</strong>}
                        {lead.vehicle_internal_code && <><br /><small>#{lead.vehicle_internal_code}</small></>}
                        <br /><small>{ORIGIN_LABELS[lead.vehicle_origin_type || ""] || "Origem não informada"}{lead.partner_name && ` · ${lead.partner_name}`}</small>
                        {lead.vehicle_origin_price_cents != null && lead.vehicle_price_cents != null && (
                          <><br /><small>Margem {formatCents(lead.vehicle_price_cents - lead.vehicle_origin_price_cents)}</small></>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td>{service ? FINANCING_SERVICES[service].label : LEAD_KIND_LABELS[lead.kind] ?? lead.kind}</td>
                  <td>{sourceLabel(lead)}</td>
                  <td>
                    {attendance
                      ? <LeadQuickFields id={lead.id} status={lead.status} assignedTo={lead.assigned_to} users={users} />
                      : <span className={`adm-badge ${lead.status}`}>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}</span>}
                    {attendance && lead.assigned_to && !userName[lead.assigned_to] && <small>Responsável inativo</small>}
                  </td>
                  <td title={new Date(lead.created_at).toLocaleString("pt-BR")}>{shortTime(lead.created_at)}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="adm-empty-row">Nenhum registro encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="adm-pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link key={n} href={pageLink(n)} className={`adm-page-link${n === page ? " active" : ""}`}>{n}</Link>
          ))}
        </div>
      )}
    </section>
  );
}
