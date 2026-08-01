import { query } from "@/lib/db";
import { VehicleStatusForm } from "@/components/VehicleStatusForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AdminVehicleRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  status: string;
  price_cents: number;
  mileage: number;
  year_make: number;
  year_model: number;
  image_url: string | null;
  updated_at: Date;
};

type CountRow = { total: number };

export default async function AdminVehiclesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const status = sp.status || "";
  const search = sp.q || "";
  const page = parseInt(sp.p || "1");
  const limit = 30;
  const offset = (page - 1) * limit;

  const conditions = ["1=1"];
  const params: unknown[] = [];
  let idx = 1;
  if (status) { conditions.push(`status=$${idx}`); params.push(status); idx++; }
  if (search) { conditions.push(`title ILIKE $${idx}`); params.push(`%${search}%`); idx++; }
  const where = conditions.join(" AND ");

  const [vehicles, countRes] = await Promise.all([
    query<AdminVehicleRow>(`SELECT id,title,brand,model,status,price_cents,mileage,year_make,year_model,image_url,updated_at FROM vehicles WHERE ${where} ORDER BY updated_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]),
    query<CountRow>(`SELECT count(*)::int as total FROM vehicles WHERE ${where}`, params),
  ]);
  const total = countRes.rows[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <div className="adm-header">
        <h1>Veículos ({total})</h1>
      </div>

      <div className="adm-card">
        <form className="adm-filters" action="/admin/veiculos">
          <input name="q" defaultValue={search} placeholder="Buscar veículo..." />
          <select name="status" defaultValue={status}>
            <option value="">Todos os status</option>
            <option value="published">Publicados</option>
            <option value="draft">Rascunho</option>
            <option value="sold">Vendidos</option>
          </select>
          <button className="button button-small">Filtrar</button>
          {(status || search) && <Link href="/admin/veiculos" className="adm-link">Limpar</Link>}
        </form>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Foto</th><th>Veículo</th><th>Ano</th><th>Km</th><th>Preço</th><th>Status</th><th>Atualizado</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {vehicles.rows.map((v) => (
                <tr key={v.id}>
                  <td><img src={v.image_url || "/em-breve.jpg"} alt="" className="adm-thumb" /></td>
                  <td><strong>{v.brand} {v.model}</strong><br/><small style={{color:"#64748b"}}>{v.title}</small></td>
                  <td>{v.year_make}/{v.year_model}</td>
                  <td>{v.mileage?.toLocaleString("pt-BR")} km</td>
                  <td>{(v.price_cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</td>
                  <td><span className={`adm-badge ${v.status}`}>{v.status}</span></td>
                  <td>{new Date(v.updated_at).toLocaleDateString("pt-BR")}</td>
                  <td><VehicleStatusForm id={v.id} status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="adm-pagination">
            {Array.from({length: totalPages}, (_, i) => i+1).map(n => (
              <Link key={n} href={`/admin/veiculos?p=${n}${status ? `&status=${status}` : ""}${search ? `&q=${search}` : ""}`}
                className={`adm-page-link${n === page ? " active" : ""}`}>{n}</Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
