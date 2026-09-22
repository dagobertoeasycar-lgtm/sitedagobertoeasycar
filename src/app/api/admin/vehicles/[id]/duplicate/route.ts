import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * Duplica um anúncio como rascunho manual. A cópia não tem source_id nem
 * external_id, então a sincronização não a reconhece nem a sobrescreve: é um
 * anúncio independente, pronto para ser ajustado e publicado.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const suffix = randomBytes(3).toString("hex");
  const result = await query<{ id: string; title: string }>(
    `insert into vehicles(slug, title, brand, model, version, year_make, year_model, price_cents, old_price_cents,
       mileage, fuel, transmission, body_type, city, description, image_url, images, color, doors, options,
       status, stock_status, featured, promotion, origin_type, partner_id, private_owner_id, store, internal_notes,
       origin_price_cents, price_markup_cents, price_markup_mode, vehicle_type, video_url)
     select left(slug, 90) || '-copia-' || $2, title || ' (cópia)', brand, model, version, year_make, year_model,
       price_cents, old_price_cents, mileage, fuel, transmission, body_type, city, description, image_url, images,
       color, doors, options, 'draft', 'available', false, promotion, origin_type, partner_id, private_owner_id,
       store, internal_notes, origin_price_cents, price_markup_cents, price_markup_mode, vehicle_type, video_url
     from vehicles where id=$1
     returning id, title`,
    [id, suffix],
  );
  const copy = result.rows[0];
  if (!copy) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  await audit(session.userId, "duplicar", "vehicle", copy.id, { origem: id }, request);
  return NextResponse.json({ id: copy.id, title: copy.title }, { status: 201 });
}
