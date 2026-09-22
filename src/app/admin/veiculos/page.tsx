import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { VehiclePhotosPanel } from "@/components/VehiclePhotosPanel";
import { VehicleRowActions } from "@/components/VehicleRowActions";
import { pastaDoParceiro, pastaDoVeiculo, separarFotos } from "@/lib/vehicle-photos";
import { brl, km, ORIGIN_LABELS, vehicleBadge } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

type AdminVehicleRow = {
  id: string;
  slug: string;
  source_id: string | null;
  title: string;
  brand: string;
  model: string;
  version: string | null;
  status: string;
  stock_status: string;
  promotion: boolean;
  featured: boolean;
  origin_type: string;
  store: string | null;
  partner_name: string | null;
  price_cents: number;
  mileage: number;
  year_make: number;
  year_model: number;
  image_url: string | null;
  images: unknown;
  plate: string | null;
  internal_code: string | null;
  photos_locked: boolean;
};

type CountRow = { total: number };

// Faixas do protótipo, em reais e km.
const PRICE_RANGES: Record<string, [number, number | null, string]> = {
  "0-50": [0, 50_000, "Até R$ 50 mil"],
  "50-80": [50_000, 80_000, "R$ 50 a 80 mil"],
  "80-120": [80_000, 120_000, "R$ 80 a 120 mil"],
  "120-200": [120_000, 200_000, "R$ 120 a 200 mil"],
  "200+": [200_000, null, "Acima de R$ 200 mil"],
};
const KM_RANGES: Record<string, [number, number | null, string]> = {
  "0-30": [0, 30_000, "Até 30 mil km"],
  "30-60": [30_000, 60_000, "30 a 60 mil km"],
  "60-100": [60_000, 100_000, "60 a 100 mil km"],
  "100+": [100_000, null, "Acima de 100 mil km"],
};

export default async function AdminVehiclesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!(await currentSession())) redirect("/admin/login");

  const sp = await searchParams;
  const filters = {
    q: sp.q || "",
    status: sp.status || "",
    brand: sp.brand || "",
    model: sp.model || "",
    price: sp.price || "",
    km: sp.km || "",
    featured: sp.featured || "",
    origin: sp.origin || "",
  };
  const page = Math.max(1, parseInt(sp.p || "1") || 1);
  const limit = 30;
  const offset = (page - 1) * limit;

  const conditions = ["1=1"];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replace("?", `$${params.length}`)); };

  if (filters.status === "promotion") conditions.push("v.status='published' and v.promotion");
  else if (filters.status === "reserved") conditions.push("v.stock_status='reserved'");
  else if (filters.status) add("v.status=?", filters.status);
  if (filters.brand) add("v.brand=?", filters.brand);
  if (filters.model) add("v.model=?", filters.model);
  if (filters.origin) add("v.origin_type=?", filters.origin);
  if (filters.featured === "1") conditions.push("v.featured");
  if (filters.featured === "0") conditions.push("not v.featured");
  const priceRange = PRICE_RANGES[filters.price];
  if (priceRange) {
    add("v.price_cents >= ?", priceRange[0] * 100);
    if (priceRange[1] !== null) add("v.price_cents < ?", priceRange[1] * 100);
  }
  const kmRange = KM_RANGES[filters.km];
  if (kmRange) {
    add("v.mileage >= ?", kmRange[0]);
    if (kmRange[1] !== null) add("v.mileage < ?", kmRange[1]);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const n = `$${params.length}`;
    conditions.push(`(v.title ilike ${n} or v.plate ilike ${n} or v.internal_code ilike ${n} or v.brand ilike ${n} or v.model ilike ${n})`);
  }
  const where = conditions.join(" and ");

  const [vehicles, countRes, brands, models] = await Promise.all([
    query<AdminVehicleRow>(
      `select v.id, v.slug, v.source_id, v.title, v.brand, v.model, v.version, v.status, v.stock_status, v.promotion, v.featured,
         v.origin_type, v.store, p.name as partner_name, v.price_cents, v.mileage, v.year_make, v.year_model, v.image_url,
         v.images, v.plate, v.internal_code, v.photos_locked
       from vehicles v left join partners p on p.id = v.partner_id
       where ${where} order by v.updated_at desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset],
    ),
    query<CountRow>(`select count(*)::int as total from vehicles v where ${where}`, params),
    query<{ brand: string }>("select distinct brand from vehicles where coalesce(brand,'') <> '' order by brand"),
    filters.brand
      ? query<{ model: string }>("select distinct model from vehicles where brand=$1 and coalesce(model,'') <> '' order by model", [filters.brand])
      : query<{ model: string }>("select distinct model from vehicles where coalesce(model,'') <> '' order by model"),
  ]);
  const total = countRes.rows[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const active = Object.values(filters).some(Boolean);
  const pageLink = (n: number) => {
    const qs = new URLSearchParams(Object.entries({ ...filters, p: String(n) }).filter(([, value]) => value));
    return `/admin/veiculos?${qs.toString()}`;
  };

  return (
    <>
      <div className="adm-header">
        <h1>Gestão de anúncios / veículos <small className="ad-count">{total.toLocaleString("pt-BR")}</small></h1>
      </div>

      <section className="adm-card">
        <form className="adm-filters" action="/admin/veiculos">
          <label>Busca<input name="q" defaultValue={filters.q} placeholder="Título, placa ou código" /></label>
          <label>Status
            <select name="status" defaultValue={filters.status}>
              <option value="">Todos</option>
              <option value="published">Publicado</option>
              <option value="promotion">Promoção</option>
              <option value="reserved">Reservado</option>
              <option value="draft">Rascunho</option>
              <option value="paused">Pausado</option>
              <option value="sold">Vendido</option>
            </select>
          </label>
          <label>Marca
            <select name="brand" defaultValue={filters.brand}>
              <option value="">Todos</option>
              {brands.rows.map((row) => <option key={row.brand} value={row.brand}>{row.brand}</option>)}
            </select>
          </label>
          <label>Modelo
            <select name="model" defaultValue={filters.model}>
              <option value="">Todos</option>
              {models.rows.map((row) => <option key={row.model} value={row.model}>{row.model}</option>)}
            </select>
          </label>
          <label>Faixa de preço
            <select name="price" defaultValue={filters.price}>
              <option value="">Todos</option>
              {Object.entries(PRICE_RANGES).map(([key, range]) => <option key={key} value={key}>{range[2]}</option>)}
            </select>
          </label>
          <label>Quilometragem
            <select name="km" defaultValue={filters.km}>
              <option value="">Todos</option>
              {Object.entries(KM_RANGES).map(([key, range]) => <option key={key} value={key}>{range[2]}</option>)}
            </select>
          </label>
          <label>Destaque
            <select name="featured" defaultValue={filters.featured}>
              <option value="">Todos</option>
              <option value="1">Em destaque</option>
              <option value="0">Sem destaque</option>
            </select>
          </label>
          <label>Origem
            <select name="origin" defaultValue={filters.origin}>
              <option value="">Todas</option>
              <option value="OWN">Estoque próprio</option>
              <option value="PARTNER">Parceiro</option>
              <option value="PRIVATE">Particular</option>
            </select>
          </label>
          <button className="ad-btn ghost">Filtrar</button>
          {active && <Link href="/admin/veiculos" className="adm-link">Limpar</Link>}
          <Link href="/admin/veiculos/novo" className="ad-btn ad-push-right"><Plus size={16} aria-hidden />Novo</Link>
        </form>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Foto</th><th>Código</th><th>Título</th><th>Ano</th><th>Km</th><th>Preço</th><th>Status</th><th>Origem</th><th>Fotos</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {vehicles.rows.map((v) => {
                // A mesma regra da extensão e da fila de tratamento: arte da
                // loja parceira não conta como foto do carro.
                const fotos = separarFotos(v.images).fotos;
                const pasta = `${pastaDoVeiculo(v)} - ${pastaDoParceiro(v)}`;
                const badge = vehicleBadge(v.status, v.stock_status, v.promotion);
                return (
                  <tr key={v.id}>
                    <td><img src={v.image_url || "/em-breve.png"} alt="" className="adm-thumb" /></td>
                    <td><small>{v.internal_code ? `#${v.internal_code}` : "—"}</small>{v.plate && <><br /><small><strong>{v.plate}</strong></small></>}</td>
                    <td>
                      <Link href={`/admin/veiculos/${v.id}`} className="ad-row-title">{v.title}</Link>
                      {v.featured && <small className="ad-flag">★ destaque</small>}
                    </td>
                    <td>{v.year_make}/{v.year_model}</td>
                    <td>{km(v.mileage)}</td>
                    <td>{brl(v.price_cents)}</td>
                    <td><span className={`adm-badge ${badge.cls}`}>{badge.label}</span></td>
                    <td>
                      {ORIGIN_LABELS[v.origin_type] ?? v.origin_type}
                      {v.origin_type === "PARTNER" && <><br /><small>{v.partner_name || v.store || "Não identificado"}</small></>}
                    </td>
                    <td>
                      <VehiclePhotosPanel id={v.id} titulo={v.title} pasta={pasta} fotos={fotos.length} />
                      {v.photos_locked && <small title="A sincronização não mexe nas fotos deste veículo">🔒 travadas</small>}
                    </td>
                    <td><VehicleRowActions id={v.id} slug={v.slug} title={v.title} synced={Boolean(v.source_id)} /></td>
                  </tr>
                );
              })}
              {!vehicles.rows.length && <tr><td colSpan={10} className="adm-empty-row">Nenhum anúncio com esses filtros.</td></tr>}
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
    </>
  );
}
