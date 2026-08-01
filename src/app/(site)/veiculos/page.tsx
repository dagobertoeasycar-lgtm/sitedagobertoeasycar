import type { Metadata } from "next";
import Link from "next/link";
import { VehicleCard } from "@/components/VehicleCard";
import { listVehicles, countVehicles, getFilterOptions, type VehicleFilters } from "@/lib/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Veículos", description: "Consulte carros usados e seminovos periciados em Osasco." };

const PAGE_SIZE = 20;
const PRICE_OPTIONS = [
  { value: "30000", label: "R$ 30 mil" }, { value: "50000", label: "R$ 50 mil" },
  { value: "70000", label: "R$ 70 mil" }, { value: "100000", label: "R$ 100 mil" },
  { value: "130000", label: "R$ 130 mil" }, { value: "160000", label: "R$ 160 mil" },
  { value: "200000", label: "R$ 200 mil" }, { value: "300000", label: "R$ 300 mil" },
];
const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" }, { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" }, { value: "year_desc", label: "Ano mais novo" },
  { value: "year_asc", label: "Ano mais antigo" }, { value: "km_asc", label: "Menor km" },
  { value: "name", label: "Marca/Modelo" },
];

function buildHref(current: Record<string, string>, overrides: Record<string, string>) {
  const merged = { ...current, ...overrides };
  Object.keys(merged).forEach(k => { if (!merged[k] || merged[k] === "0") delete merged[k]; });
  const qs = new URLSearchParams(merged).toString();
  return `/veiculos${qs ? `?${qs}` : ""}`;
}

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filters: VehicleFilters = {
    q: sp.q || "", brand: sp.brand || "", fuel: sp.fuel || "", transmission: sp.transmission || "",
    yearMin: sp.yearMin ? parseInt(sp.yearMin) : undefined, yearMax: sp.yearMax ? parseInt(sp.yearMax) : undefined,
    priceMin: sp.priceMin ? parseInt(sp.priceMin) : undefined, priceMax: sp.priceMax ? parseInt(sp.priceMax) : undefined,
    sort: sp.sort || "recent", page: parseInt(sp.p || "1"),
  };

  const [vehicles, total, opts] = await Promise.all([
    listVehicles(filters).catch(() => []),
    countVehicles(filters).catch(() => 0),
    getFilterOptions().catch(() => ({ brands: [], fuels: [], transmissions: [], years: [] })),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const page = filters.page || 1;
  const hasActiveFilters = !!(filters.brand || filters.fuel || filters.transmission || filters.yearMin || filters.yearMax || filters.priceMin || filters.priceMax);

  return (
    <>
      <section className="page-hero"><div className="shell"><p className="eyebrow">Estoque Dagoberto Easycar</p><h1>Encontre seu próximo veículo</h1><p>Use a busca e os filtros para encontrar o carro ideal.</p></div></section>
      <section className="shell section">
        {/* Search + Filter + Sort bar */}
        <div className="filter-bar">
          <form className="search-box" action="/veiculos">
            <input name="q" defaultValue={filters.q} placeholder="Pesquisar..." aria-label="Buscar veículo" />
            <button type="submit" className="search-btn" aria-label="Buscar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </button>
            {/* Preserve active filters in hidden inputs */}
            {filters.brand && <input type="hidden" name="brand" value={filters.brand} />}
            {filters.fuel && <input type="hidden" name="fuel" value={filters.fuel} />}
            {filters.transmission && <input type="hidden" name="transmission" value={filters.transmission} />}
            {filters.sort && filters.sort !== "recent" && <input type="hidden" name="sort" value={filters.sort} />}
          </form>
          <details className="filter-dropdown">
            <summary className={`filter-btn${hasActiveFilters ? " active" : ""}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              Filtrar{hasActiveFilters ? " *" : ""}
            </summary>
            <div className="filter-panel">
              <form action="/veiculos">
                {filters.q && <input type="hidden" name="q" value={filters.q} />}
                {filters.sort && filters.sort !== "recent" && <input type="hidden" name="sort" value={filters.sort} />}
                <div className="filter-group">
                  <label>Marca</label>
                  <select name="brand" defaultValue={filters.brand}>
                    <option value="">Todas</option>
                    {opts.brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Combustível</label>
                  <select name="fuel" defaultValue={filters.fuel}>
                    <option value="">Todos</option>
                    {opts.fuels.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Câmbio</label>
                  <select name="transmission" defaultValue={filters.transmission}>
                    <option value="">Todos</option>
                    {opts.transmissions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Preço mínimo</label>
                    <select name="priceMin" defaultValue={filters.priceMin?.toString() || ""}>
                      <option value="">Sem mín.</option>
                      {PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Preço máximo</label>
                    <select name="priceMax" defaultValue={filters.priceMax?.toString() || ""}>
                      <option value="">Sem máx.</option>
                      {PRICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Ano mínimo</label>
                    <select name="yearMin" defaultValue={filters.yearMin?.toString() || ""}>
                      <option value="">Sem mín.</option>
                      {opts.years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="filter-group">
                    <label>Ano máximo</label>
                    <select name="yearMax" defaultValue={filters.yearMax?.toString() || ""}>
                      <option value="">Sem máx.</option>
                      {opts.years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div className="filter-actions">
                  <button type="submit" className="button">Aplicar filtros</button>
                  <Link href="/veiculos" className="button button-outline">Limpar</Link>
                </div>
              </form>
            </div>
          </details>
          <details className="filter-dropdown sort-dropdown">
            <summary className="filter-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5h10M11 9h7M11 13h4M3 17l3 3 3-3M6 18V4"/></svg>
              Ordenar por
            </summary>
            <div className="filter-panel sort-panel">
              {SORT_OPTIONS.map(o => (
                <Link key={o.value} href={buildHref(sp, { sort: o.value, p: "1" })}
                  className={`sort-option${filters.sort === o.value ? " active" : ""}`}>{o.label}</Link>
              ))}
            </div>
          </details>
        </div>

        {total > 0 && <p className="results-count"><strong>{total}</strong> veículos encontrados</p>}

        {vehicles.length ? (
          <>
            <div className="vehicle-grid">
              {vehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}
            </div>
            {totalPages > 1 && (
              <nav className="pagination" aria-label="Páginas">
                {page > 1 && <Link href={buildHref(sp, { p: String(page - 1) })} className="pagination-link">&#8249; Anterior</Link>}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <Link key={n} href={buildHref(sp, { p: String(n) })} className={`pagination-link${n === page ? " active" : ""}`}>{n}</Link>
                ))}
                {page < totalPages && <Link href={buildHref(sp, { p: String(page + 1) })} className="pagination-link">Próxima &#8250;</Link>}
              </nav>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h2>Nenhum veículo encontrado</h2>
            <p>{hasActiveFilters || filters.q ? "Tente outros filtros ou limpe a busca." : "O estoque está sendo atualizado."}</p>
            {hasActiveFilters && <Link className="button" href="/veiculos">Limpar filtros</Link>}
          </div>
        )}
      </section>
    </>
  );
}
