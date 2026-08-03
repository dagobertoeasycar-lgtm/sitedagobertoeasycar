import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  kind: string;
  message: string | null;
  status: string;
  created_at: Date;
};

type CountRow = { total: number };

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = parseInt(sp.p || "1");
  const status = sp.status || "";
  const limit = 30;
  const offset = (page - 1) * limit;

  const conditions = ["1=1"];
  const params: unknown[] = [];
  let idx = 1;
  if (status) { conditions.push(`status=$${idx}`); params.push(status); idx++; }
  const where = conditions.join(" AND ");

  const [leads, countRes] = await Promise.all([
    query<LeadRow>(`SELECT * FROM leads WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]),
    query<CountRow>(`SELECT count(*)::int as total FROM leads WHERE ${where}`, params),
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
            <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Tipo</th><th>Mensagem</th><th>Status</th><th>Data</th></tr></thead>
            <tbody>
              {leads.rows.map((l) => (
                <tr key={l.id}>
                  <td><strong>{l.name}</strong></td>
                  <td><a href={`https://wa.me/55${l.phone?.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">{l.phone}</a></td>
                  <td>{l.email || "—"}</td>
                  <td>{l.kind === "wholesale" ? "Atacado" : l.kind}</td>
                  <td style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.message || "—"}</td>
                  <td><span className={`adm-badge ${l.status}`}>{l.status}</span></td>
                  <td>{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {leads.rows.length === 0 && <tr><td colSpan={7} style={{textAlign:"center",padding:30,color:"#94a3b8"}}>Nenhum lead encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
