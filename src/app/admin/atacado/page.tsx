import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type WholesaleLeadRow = {
  id: string;
  company_name: string;
  cnpj: string;
  phone: string;
  email: string;
  status: string;
  created_at: Date;
};

export default async function AdminWholesalePage() {
  const leads = await query<WholesaleLeadRow>(
    `SELECT id, company_name, cnpj, phone, email, status, created_at
       FROM leads
      WHERE kind = 'wholesale'
      ORDER BY created_at DESC`,
  );

  return (
    <>
      <div className="adm-header">
        <div>
          <h1>Leads de Atacado ({leads.rows.length})</h1>
          <p className="adm-header-description">Cadastros enviados por lojistas e compradores empresariais.</p>
        </div>
      </div>
      <div className="adm-card">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Razão social</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th>Status</th><th>Recebido em</th></tr></thead>
            <tbody>
              {leads.rows.map((lead) => {
                const phone = lead.phone.replace(/\D/g, "");
                const whatsapp = phone.startsWith("55") ? phone : `55${phone}`;
                return (
                  <tr key={lead.id}>
                    <td><strong>{lead.company_name}</strong></td>
                    <td>{lead.cnpj}</td>
                    <td><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">{lead.phone}</a></td>
                    <td><a href={`mailto:${lead.email}`}>{lead.email}</a></td>
                    <td><span className={`adm-badge ${lead.status}`}>{lead.status === "new" ? "Novo" : lead.status}</span></td>
                    <td>{new Date(lead.created_at).toLocaleString("pt-BR")}</td>
                  </tr>
                );
              })}
              {leads.rows.length === 0 && <tr><td colSpan={6} className="adm-empty-row">Nenhum lead de atacado recebido.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
