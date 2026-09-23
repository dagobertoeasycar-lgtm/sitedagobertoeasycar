import { NextRequest, NextResponse } from "next/server";
import { apiArea } from "@/lib/permissions";
import { query } from "@/lib/db";

/** Busca rápida de veículos para vincular ao lead no CRM. GET ?q=texto */
export async function GET(request: NextRequest) {
  const guard = await apiArea("leads");
  if (guard.error) return guard.error;
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json([]);
  const terms = q.split(/\s+/).slice(0, 5);
  const params = terms.map((term) => `%${term}%`);
  const where = terms.map((_, index) => `(title ilike $${index + 1} or brand ilike $${index + 1} or model ilike $${index + 1} or version ilike $${index + 1} or catalog_item_id ilike $${index + 1} or coalesce(internal_code,'') ilike $${index + 1})`);
  const result = await query(
    `select id, title, slug, price_cents, image_url, coalesce(nullif(internal_code,''), catalog_item_id) as code,
       concat_ws('/', year_make, year_model) as year, mileage, status, version
     from vehicles where status <> 'deleted' and ${where.join(" and ")}
     order by (status = 'published') desc, updated_at desc limit 12`,
    params,
  );
  return NextResponse.json(result.rows);
}
