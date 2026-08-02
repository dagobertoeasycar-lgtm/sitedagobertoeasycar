import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100); }
export async function POST(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json() as Record<string, string>;
  const title = String(body.title ?? "").trim();
  const slug = slugify(body.slug || title);
  const yearMake = Number(body.yearMake);
  const yearModel = Number(body.yearModel);
  const priceCents = Math.round(Number(body.price) * 100);
  const mileage = Number(body.mileage);
  const stockStatus = ["available", "reserved", "sold"].includes(body.stockStatus) ? body.stockStatus : "available";
  if (title.length < 3 || !slug || yearMake < 1950 || yearModel < 1950 || !Number.isFinite(priceCents) || priceCents < 0 || !Number.isFinite(mileage) || mileage < 0) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const result = await query<{ id: string }>(`insert into vehicles(slug,title,brand,model,version,year_make,year_model,price_cents,mileage,fuel,transmission,body_type,description,image_url,status,stock_status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning id`, [slug,title,String(body.brand ?? "").trim(),String(body.model ?? "").trim(),String(body.version ?? "").trim(),yearMake,yearModel,priceCents,mileage,String(body.fuel ?? "").trim(),String(body.transmission ?? "").trim(),String(body.bodyType ?? "").trim(),String(body.description ?? "").trim(),String(body.imageUrl ?? "").trim() || null,["draft","published","paused","sold"].includes(body.status) ? body.status : "draft",stockStatus]);
  await query("insert into audit_log(actor_id,action,entity_type,entity_id) values($1,'create','vehicle',$2)", [session.userId, result.rows[0].id]);
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}
