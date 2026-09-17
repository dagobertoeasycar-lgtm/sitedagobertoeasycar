import { query } from "@/lib/db";
import { currentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatCents } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * Rótulos internos da origem. O nome do parceiro aparece só aqui, no painel —
 * nunca no anúncio público nem em qualquer conteúdo enviado ao cliente.
 */
const originLabels: Record<string, string> = {
  OWN: "Estoque próprio",
  PARTNER: "Loja parceira",
  PRIVATE: "Venda particular",
};

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  kind: string;
  message: string | null;
  status: string;
  created_at: Date;
  // Rastreabilidade interna da origem do veículo — nunca exposta ao cliente.
  vehicle_title: string | null;
  vehicle_internal_code: string | null;
  vehicle_origin_type: string | null;
  vehicle_origin_price_cents: number | null;
  vehicle_price_cents: number | null;
  partner_name: string | null;
};

type CountRow = { total: number };

const kindLabels: Record<string, string> = {
  contact: "Contato",
  financing: "Financiamento",
  sell_car: "Venda de veículo",
  wholesale: "Atacado",
  partner: "Parceiro",
  find_car: "Autodrive Busca",
  vehicle_interest: "Interesse em veículo",
};

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!(await currentSession())) redirect("/admin/login");
  const sp = await searchParams;
  const page = parseInt(sp.p || "1");
  const status = sp.status || "";
  const limit = 30;
  const offset = (page - 1) * limit;

  const conditions = ["1=1"];
  const params: unknown[] = [];
  let idx = 1;
  if (status) { conditions.push(`l.status=$${idx}`); params.push(status); idx++; }
  const where = conditions.join(" AND ");

  const [leads, countRes] = await Promise.all([
    query<LeadRow>(
      `SELECT l.*,
              v.title AS vehicle_title,
              v.internal_code AS vehicle_internal_code,
              COALESCE(l.vehicle_origin_type, v.origin_type) AS vehicle_origin_type,
              v.origin_price_cents AS vehicle_origin_price_cents,
              v.price_cents AS vehicle_price_cents,
              p.name AS partner_name
         FROM leads l
         LEFT JOIN vehicles v ON v.id = l.vehicle_id
         LEFT JOIN partners p ON p.id = COALESCE(l.partner_id, v.partner_id)
        WHERE ${where}
        ORDER BY l.created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    query<CountRow>(`SELECT count(*)::int as total FROM leads l WHERE ${where}`, params),
  ]);
  const total = countRes.rows[0]?.total || 0;

  return (
    <>
      <div className="adm-header"><h1>Leads / Contatos ({total})</h1></div>
      <div className="adm-card">
        <form className="adm-filters" action="/admin/leads">
          <select name="status" defaultValue={status}>
            <option value="">Todos</option>
            <option value="new">Novo</option>
            <option value="contacted">Contatado</option>
            <option value="converted">Convertido</option>
          </select>
          <button className="button button-small">Filtrar</button>
        </form>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Tipo</th><th>Veículo e origem</th><th>Mensagem</th><th>Status</th><th>Data</th></tr></thead>
            <tbody>
              {leads.rows.map((l) => (
                <tr key={l.id}>
                  <td><strong>{l.name}</strong></td>
                  <td><a href={`https://wa.me/55${l.phone?.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">{l.phone}</a></td>
                  <td>{l.email || "—"}</td>
                  <td>{kindLabels[l.kind] || l.kind}</td>
                  <td className="adm-lead-origin">
                    {l.vehicle_title ? (
                      <>
                        <strong>{l.vehicle_title}</strong>
                        {l.vehicle_internal_code && <><br /><small>{l.vehicle_internal_code}</small></>}
                        <br />
                        <span className="adm-badge">{originLabels[l.vehicle_origin_type || ""] || "Origem não informada"}</span>
                        {l.partner_name && <><br /><small>Parceiro: <strong>{l.partner_name}</strong></small></>}
                        {l.vehicle_origin_price_cents != null && l.vehicle_price_cents != null && (
                          <>
                            <br />
                            <small>
                              Anunciado {formatCents(l.vehicle_price_cents)} · origem {formatCents(l.vehicle_origin_price_cents)} · margem{" "}
                              {formatCents(l.vehicle_price_cents - l.vehicle_origin_price_cents)}
                            </small>
                          </>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.message || "—"}</td>
                  <td><span className={`adm-badge ${l.status}`}>{l.status}</span></td>
                  <td>{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {leads.rows.length === 0 && <tr><td colSpan={8} style={{textAlign:"center",padding:30,color:"#5b6777"}}>Nenhum lead encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
