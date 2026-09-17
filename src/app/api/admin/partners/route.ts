import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  mergeConnectorConfig,
  normalizePartnerConnector,
  normalizePartnerOriginKind,
  validatePartnerInput,
  type PartnerInput,
} from "@/lib/partners";

function stableExternalId(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 24);
}

function slugSource(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "")
    .slice(0, 40);
}

function readBody(body: Record<string, unknown>): PartnerInput {
  const text = (key: string) => String(body[key] ?? "").trim();
  return {
    name: text("name"),
    tradeName: text("tradeName"),
    legalName: text("legalName"),
    cnpj: text("cnpj"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    city: text("city"),
    stockUrl: text("stockUrl"),
    stockUrlAlt: text("stockUrlAlt"),
    originKind: text("originKind"),
    notes: text("notes"),
    active: body.active !== false,
    connector: text("connector"),
    baseUrl: text("baseUrl"),
    vehicleFilter: text("vehicleFilter"),
  };
}

export async function POST(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const input = readBody((await request.json()) as Record<string, unknown>);
  const problem = validatePartnerInput(input);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const connector = normalizePartnerConnector(input.connector);
  const config = mergeConnectorConfig(null, input);
  // Identidade da fonte: é ela que vai para vehicles.source_id, então precisa
  // ser estável e única. Só existe para parceiro com adaptador configurado.
  const syncSourceId = connector ? slugSource(input.name) || stableExternalId(input.name) : null;

  const result = await query<{ id: string }>(
    `INSERT INTO partners(
       source_id, external_id, name, trade_name, legal_name, cnpj, phone, whatsapp,
       email, city, stock_url, stock_url_alt, origin_kind, notes, active,
       connector, connector_config, sync_source_id, updated_at
     ) VALUES ('manual_admin',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               $15,$16::jsonb,$17, now())
     ON CONFLICT (source_id, external_id) DO UPDATE SET
       name = excluded.name,
       trade_name = excluded.trade_name,
       legal_name = excluded.legal_name,
       cnpj = excluded.cnpj,
       phone = excluded.phone,
       whatsapp = excluded.whatsapp,
       email = excluded.email,
       city = excluded.city,
       stock_url = excluded.stock_url,
       stock_url_alt = excluded.stock_url_alt,
       origin_kind = excluded.origin_kind,
       notes = excluded.notes,
       active = excluded.active,
       connector = excluded.connector,
       connector_config = excluded.connector_config,
       sync_source_id = coalesce(partners.sync_source_id, excluded.sync_source_id),
       updated_at = now()
     RETURNING id`,
    [
      stableExternalId(input.name),
      input.name,
      input.tradeName || null,
      input.legalName || null,
      input.cnpj || null,
      input.phone || null,
      input.whatsapp || null,
      input.email || null,
      input.city || "",
      input.stockUrl || null,
      input.stockUrlAlt || null,
      normalizePartnerOriginKind(input.originKind),
      input.notes || "",
      input.active !== false,
      connector,
      JSON.stringify(config),
      syncSourceId,
    ],
  );

  const id = result.rows[0].id;
  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'create','partner',$2,$3::jsonb)",
    [session.userId, id, JSON.stringify({ name: input.name })],
  );
  return NextResponse.json({ id }, { status: 201 });
}
