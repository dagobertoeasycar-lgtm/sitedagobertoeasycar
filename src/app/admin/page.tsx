import { SyncPanel } from "@/components/SyncPanel";
import { redirect } from "next/navigation";
import { AdminVehicleForm } from "@/components/AdminVehicleForm";
import { VehicleStatusForm } from "@/components/VehicleStatusForm";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";

type CountRow = { vehicles: string; leads: string; users: string };
type VehicleRow = { id: string; title: string; status: string; price_cents: number; updated_at: Date };
type LeadRow = { id: string; name: string; phone: string; kind: string; status: string; created_at: Date };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  const account = await query<{ must_change_password: boolean }>("select must_change_password from users where id=$1 and active limit 1", [session.userId]);
  if (account.rows[0]?.must_change_password) redirect("/admin/trocar-senha");
  const [counts, vehicles, leads] = await Promise.all([
    query<CountRow>("select (select count(*) from vehicles)::text vehicles, (select count(*) from leads)::text leads, (select count(*) from users where active)::text users"),
    query<VehicleRow>("select id,title,status,price_cents,updated_at from vehicles order by updated_at desc limit 40"),
    query<LeadRow>("select id,name,phone,kind,status,created_at from leads order by created_at desc limit 30"),
  ]);
  const count = counts.rows[0];
  return <section className="shell admin-shell"><div className="section-heading"><div><p className="eyebrow dark">Painel</p><h1>Administração</h1></div><form action="/api/auth/logout" method="post"><button className="button button-outline">Sair</button></form></div><div className="admin-grid"><div className="stat"><span>Veículos</span><strong>{count.vehicles}</strong></div><div className="stat"><span>Leads</span><strong>{count.leads}</strong></div><div className="stat"><span>Usuários ativos</span><strong>{count.users}</strong></div></div><AdminVehicleForm /><SyncPanel />
<h2>Estoque</h2><div className="admin-table-wrap"><table><thead><tr><th>Veículo</th><th>Status</th><th>Preço</th><th>Atualizado</th><th>Ações</th></tr></thead><tbody>{vehicles.rows.map((vehicle) => <tr key={vehicle.id}><td>{vehicle.title}</td><td>{vehicle.status}</td><td>{(vehicle.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td>{new Date(vehicle.updated_at).toLocaleString("pt-BR")}</td><td><VehicleStatusForm id={vehicle.id} status={vehicle.status} /></td></tr>)}</tbody></table></div><h2>Leads recentes</h2><div className="admin-table-wrap"><table><thead><tr><th>Nome</th><th>Telefone</th><th>Tipo</th><th>Status</th><th>Data</th></tr></thead><tbody>{leads.rows.map((lead) => <tr key={lead.id}><td>{lead.name}</td><td>{lead.phone}</td><td>{lead.kind}</td><td>{lead.status}</td><td>{new Date(lead.created_at).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div></section>;
}
