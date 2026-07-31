import { query } from "@/lib/db";

export type Vehicle = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  model: string;
  version: string;
  year_model: number;
  year_make: number;
  price_cents: number;
  mileage: number;
  fuel: string;
  transmission: string;
  body_type: string;
  city: string;
  status: string;
  featured: boolean;
  promotion: boolean;
  image_url: string | null;
  description: string;
};

export async function listVehicles(search = "") {
  const term = `%${search.trim()}%`;
  const result = await query<Vehicle>(
    `select * from vehicles
     where status = 'published' and ($1 = '%%' or title ilike $1 or brand ilike $1 or model ilike $1)
     order by featured desc, created_at desc limit 60`,
    [term],
  );
  return result.rows;
}

export async function findVehicle(slug: string) {
  const result = await query<Vehicle>("select * from vehicles where slug = $1 and status = 'published' limit 1", [slug]);
  return result.rows[0] ?? null;
}

export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}
