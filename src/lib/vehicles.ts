import { query } from "@/lib/db";

export type MediaItem = { type: "video" | "image"; url: string };

export type Vehicle = {
  id: string; slug: string; title: string; brand: string; model: string; version: string;
  year_model: number; year_make: number; price_cents: number; old_price_cents: number | null;
  mileage: number; fuel: string; transmission: string; body_type: string; city: string;
  color: string; doors: number; status: string; featured: boolean; promotion: boolean;
  image_url: string | null; images: MediaItem[] | string[]; options: string[];
  store: string; video_url: string; description: string;
};

export type VehicleFilters = {
  q?: string; brand?: string; fuel?: string; transmission?: string;
  yearMin?: number; yearMax?: number; priceMin?: number; priceMax?: number;
  sort?: string; page?: number;
};

const PAGE_SIZE = 20;

export async function listVehicles(filters: VehicleFilters = {}) {
  const { q = "", brand, fuel, transmission, yearMin, yearMax, priceMin, priceMax, sort = "recent", page = 1 } = filters;
  const conditions: string[] = ["status = 'published'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (q.trim()) {
    conditions.push(`(title ILIKE $${paramIdx} OR brand ILIKE $${paramIdx} OR model ILIKE $${paramIdx})`);
    params.push(`%${q.trim()}%`);
    paramIdx++;
  }
  if (brand) { conditions.push(`brand ILIKE $${paramIdx}`); params.push(brand); paramIdx++; }
  if (fuel) { conditions.push(`fuel ILIKE $${paramIdx}`); params.push(`%${fuel}%`); paramIdx++; }
  if (transmission) { conditions.push(`transmission ILIKE $${paramIdx}`); params.push(`%${transmission}%`); paramIdx++; }
  if (yearMin) { conditions.push(`year_model >= $${paramIdx}`); params.push(yearMin); paramIdx++; }
  if (yearMax) { conditions.push(`year_model <= $${paramIdx}`); params.push(yearMax); paramIdx++; }
  if (priceMin) { conditions.push(`price_cents >= $${paramIdx}`); params.push(priceMin * 100); paramIdx++; }
  if (priceMax) { conditions.push(`price_cents <= $${paramIdx}`); params.push(priceMax * 100); paramIdx++; }

  const where = conditions.join(" AND ");
  const orderMap: Record<string, string> = {
    recent: "created_at DESC",
    oldest: "created_at ASC",
    price_asc: "price_cents ASC",
    price_desc: "price_cents DESC",
    year_desc: "year_model DESC, year_make DESC",
    year_asc: "year_model ASC, year_make ASC",
    km_asc: "mileage ASC",
    name: "title ASC",
  };
  // Em breve (no image) always last, then featured first, then sort
  const orderBy = `CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END, featured DESC, ${orderMap[sort] || orderMap.recent}`;
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;

  params.push(PAGE_SIZE, offset);
  const result = await query<Vehicle>(
    `SELECT * FROM vehicles WHERE ${where} ORDER BY ${orderBy} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    params,
  );
  return result.rows;
}

export async function countVehicles(filters: VehicleFilters = {}) {
  const { q = "", brand, fuel, transmission, yearMin, yearMax, priceMin, priceMax } = filters;
  const conditions: string[] = ["status = 'published'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (q.trim()) { conditions.push(`(title ILIKE $${paramIdx} OR brand ILIKE $${paramIdx} OR model ILIKE $${paramIdx})`); params.push(`%${q.trim()}%`); paramIdx++; }
  if (brand) { conditions.push(`brand ILIKE $${paramIdx}`); params.push(brand); paramIdx++; }
  if (fuel) { conditions.push(`fuel ILIKE $${paramIdx}`); params.push(`%${fuel}%`); paramIdx++; }
  if (transmission) { conditions.push(`transmission ILIKE $${paramIdx}`); params.push(`%${transmission}%`); paramIdx++; }
  if (yearMin) { conditions.push(`year_model >= $${paramIdx}`); params.push(yearMin); paramIdx++; }
  if (yearMax) { conditions.push(`year_model <= $${paramIdx}`); params.push(yearMax); paramIdx++; }
  if (priceMin) { conditions.push(`price_cents >= $${paramIdx}`); params.push(priceMin * 100); paramIdx++; }
  if (priceMax) { conditions.push(`price_cents <= $${paramIdx}`); params.push(priceMax * 100); paramIdx++; }

  const where = conditions.join(" AND ");
  const result = await query<{ count: string }>(`SELECT count(*)::text as count FROM vehicles WHERE ${where}`, params);
  return parseInt(result.rows[0]?.count || "0");
}

export async function getFilterOptions() {
  const [brands, fuels, transmissions, years] = await Promise.all([
    query<{ brand: string }>("SELECT DISTINCT brand FROM vehicles WHERE status='published' ORDER BY brand"),
    query<{ fuel: string }>("SELECT DISTINCT fuel FROM vehicles WHERE status='published' AND fuel != '' ORDER BY fuel"),
    query<{ transmission: string }>("SELECT DISTINCT transmission FROM vehicles WHERE status='published' AND transmission != '' ORDER BY transmission"),
    query<{ y: number }>("SELECT DISTINCT year_model as y FROM vehicles WHERE status='published' ORDER BY year_model DESC"),
  ]);
  return {
    brands: brands.rows.map(r => r.brand).filter(Boolean),
    fuels: fuels.rows.map(r => r.fuel).filter(Boolean),
    transmissions: transmissions.rows.map(r => r.transmission).filter(Boolean),
    years: years.rows.map(r => r.y),
  };
}

export async function findVehicle(slug: string) {
  const result = await query<Vehicle>("SELECT * FROM vehicles WHERE slug = $1 AND status = 'published' LIMIT 1", [slug]);
  return result.rows[0] ?? null;
}

export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}
