import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sessionFor } from "@/lib/permissions";
import { query } from "@/lib/db";

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100); }
function stableExternalId(value: string) { return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 24); }

export async function POST(request: NextRequest) {
  const session = await sessionFor("veiculos");
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json() as Record<string, string>;
  const title = String(body.title ?? "").trim();
  const slug = slugify(body.slug || title);
  const yearMake = Number(body.yearMake);
  const yearModel = Number(body.yearModel);
  const priceCents = Math.round(Number(body.price) * 100);
  const mileage = Number(body.mileage);
  const stockStatus = ["available", "reserved", "sold"].includes(body.stockStatus) ? body.stockStatus : "available";
  const originType = ["OWN", "PARTNER", "PRIVATE"].includes(body.originType) ? body.originType : "OWN";
  if (title.length < 3 || !slug || yearMake < 1950 || yearModel < 1950 || !Number.isFinite(priceCents) || priceCents < 0 || !Number.isFinite(mileage) || mileage < 0) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  let partnerId: string | null = null;
  let privateOwnerId: string | null = null;
  let store = "";

  if (originType === "PARTNER") {
    const partnerName = String(body.partnerName ?? "").trim();
    if (!partnerName) return NextResponse.json({ error: "Informe o parceiro do veículo." }, { status: 400 });
    const partnerCity = String(body.partnerCity ?? "").trim();
    const partner = await query<{ id: string }>(
      `insert into partners(source_id, external_id, name, city, notes, active, updated_at)
       values('manual_admin', $1, $2, $3, 'Parceiro cadastrado pelo painel administrativo.', true, now())
       on conflict (source_id, external_id) do update set
         name=excluded.name,
         city=excluded.city,
         active=true,
         updated_at=now()
       returning id`,
      [stableExternalId(partnerName), partnerName, partnerCity],
    );
    partnerId = partner.rows[0]?.id ?? null;
    store = partnerName;
  }

  if (originType === "PRIVATE") {
    const ownerName = String(body.ownerName ?? "").trim();
    const ownerWhatsapp = String(body.ownerWhatsapp ?? "").trim();
    if (ownerName.length < 2 || ownerWhatsapp.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Informe o proprietário particular." }, { status: 400 });
    const owner = await query<{ id: string }>(
      "insert into private_vehicle_owners(name, whatsapp, city, notes) values($1,$2,$3,$4) returning id",
      [ownerName, ownerWhatsapp, String(body.ownerCity ?? "").trim(), String(body.internalNotes ?? "").trim()],
    );
    privateOwnerId = owner.rows[0]?.id ?? null;
  }

  const result = await query<{ id: string }>(`insert into vehicles(slug,title,brand,model,version,year_make,year_model,price_cents,mileage,fuel,transmission,body_type,description,image_url,status,stock_status,origin_type,partner_id,private_owner_id,store,internal_notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) returning id`, [slug,title,String(body.brand ?? "").trim(),String(body.model ?? "").trim(),String(body.version ?? "").trim(),yearMake,yearModel,priceCents,mileage,String(body.fuel ?? "").trim(),String(body.transmission ?? "").trim(),String(body.bodyType ?? "").trim(),String(body.description ?? "").trim(),String(body.imageUrl ?? "").trim() || null,["draft","published","paused","sold"].includes(body.status) ? body.status : "draft",stockStatus,originType,partnerId,privateOwnerId,store,String(body.internalNotes ?? "").trim()]);
  await query("insert into audit_log(actor_id,action,entity_type,entity_id) values($1,'create','vehicle',$2)", [session.userId, result.rows[0].id]);
  return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
}
