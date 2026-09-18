import { query } from "@/lib/db";
import { VehicleStatusForm } from "@/components/VehicleStatusForm";
import { AdminVehicleForm } from "@/components/AdminVehicleForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AdminVehicleRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  status: string;
  stock_status: string;
  origin_type: string;
  store: string | null;
  partner_name: string | null;
  price_cents: number;
  mileage: number;
  year_make: number;
  year_model: number;
  image_url: string | null;
  updated_at: Date;
};

type CountRow = { total: number };

const originLabels: Record<string, string> = {
  OWN: "Estoque Autodrive",
  PARTNER: "Lojista parceiro",
  PRIVATE: "Particular",
};

export default async function AdminVehiclesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const status = sp.status || "";
  const origin = sp.origin || "";
  const search = sp.q || "";
  const page = parseInt(sp.p || "1");
  const limit = 30;
  const offset = (page - 1) * limit;

  const conditions = ["1=1"];
  const params: unknown[] = [];
  let idx = 1;
  if (status) { conditions.push(`v.status=$${idx}`); params.push(status); idx++; }
  if (origin) { conditions.push(`v.origin_type=$${idx}`); params.push(origin); idx++; }
  if (search) { conditions.push(`v.title ILIKE $${idx}`); params.push(`%${search}%`); idx++; }
  const where = conditions.join(" AND ");

  const [vehicles, countRes] = await Promise.all([
    query<AdminVehicleRow>(`SELECT v.id,v.title,v.brand,v.model,v.status,v.stock_status,v.origin_type,v.store,p.name as partner_name,v.price_cents,v.mileage,v.year_make,v.year_model,v.image_url,v.updated_at FROM vehicles v LEFT JOIN partners p ON p.id = v.partner_id WHERE ${where} ORDER BY v.updated_at DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, limit, offset]),
    query<CountRow>(`SELECT count(*)::int as total FROM vehicles v WHERE ${where}`, params),
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
          <select name="origin" defaultValue={origin}>
            <option value="">Todas as origens</option>
            <option value="OWN">Estoque Autodrive</option>
            <option value="PARTNER">Lojista parceiro</option>
            <option value="PRIVATE">Particular</option>
          </select>
          <button className="button button-small">Filtrar</button>
          {(status || origin || search) && <Link href="/admin/veiculos" className="adm-link">Limpar</Link>}
        </form>

        <details className="adm-create-panel">
          <summary>Cadastrar veículo manualmente</summary>
          <AdminVehicleForm />
        </details>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Foto</th><th>Veículo</th><th>Origem</th><th>Ano</th><th>Km</th><th>Preço</th><th>Status</th><th>Atualizado</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {vehicles.rows.map((v) => (
                <tr key={v.id}>
                  <td><img src={v.image_url || "/em-breve.png"} alt="" className="adm-thumb" /></td>
                  <td><strong>{v.brand} {v.model}</strong><br/><small style={{color:"#64748b"}}>{v.title}</small></td>
                  <td><span className={`adm-badge origin-${v.origin_type.toLowerCase()}`}>{originLabels[v.origin_type] || v.origin_type}</span>{v.origin_type === "PARTNER" && <><br/><small>{v.partner_name || v.store || "Parceiro não identificado"}</small></>}</td>
                  <td>{v.year_make}/{v.year_model}</td>
                  <td>{v.mileage?.toLocaleString("pt-BR")} km</td>
                  <td>{(v.price_cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0})}</td>
                  <td><span className={`adm-badge ${v.status}`}>{v.status}</span><br/><small>{v.stock_status}</small></td>
                  <td>{new Date(v.updated_at).toLocaleDateString("pt-BR")}</td>
                  <td><VehicleStatusForm id={v.id} status={v.status} stockStatus={v.stock_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="adm-pagination">
            {Array.from({length: totalPages}, (_, i) => i+1).map(n => (
              <Link key={n} href={`/admin/veiculos?p=${n}${status ? `&status=${status}` : ""}${origin ? `&origin=${origin}` : ""}${search ? `&q=${search}` : ""}`}
                className={`adm-page-link${n === page ? " active" : ""}`}>{n}</Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
