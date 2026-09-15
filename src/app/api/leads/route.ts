import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { safeMailError, sendLeadNotification } from "@/lib/email";
import { formatCnpj, isValidCnpj } from "@/lib/cnpj";
import { normalizeVehicleOrigin } from "@/lib/vehicle-origin";

const kinds = new Set(["contact", "financing", "sell_car", "wholesale", "partner", "find_car", "vehicle_interest"]);

const payloadKeys = [
  "city", "brand", "model", "version", "year", "yearMin", "mileage", "transmission", "fuel", "plate", "color",
  "targetPrice", "vehicleStatus", "photoLinks", "budget", "downPayment", "hasTrade", "wantsFinancing",
  "companyName", "tradeName", "cnpj", "address", "instagram", "website", "averageInventory", "currentSystem",
  "desiredWork", "vehicleId", "vehicleTitle", "vehicleOriginType", "leadSource", "campaign", "utmSource",
  "utmMedium", "utmCampaign", "pageUrl",
];

function text(body: Record<string, unknown>, key: string, max = 2000) {
  return String(body[key] ?? "").trim().slice(0, max);
}

function list(body: Record<string, unknown>, key: string) {
  const value = body[key];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 20);
  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

function leadPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const key of payloadKeys) {
    const value = body[key];
    if (Array.isArray(value)) {
      const items = value.map((item) => String(item).trim().slice(0, 300)).filter(Boolean);
      if (items.length) payload[key] = items;
      continue;
    }
    const clean = String(value ?? "").trim();
    if (clean) payload[key] = clean.slice(0, 2000);
  }
  return payload;
}

function line(label: string, value: unknown) {
  const clean = Array.isArray(value) ? value.join(", ") : String(value ?? "").trim();
  return clean ? `${label}: ${clean}` : "";
}

function buildMessage(kind: string, body: Record<string, unknown>, fallback: string) {
  if (kind === "sell_car") {
    return [
      "Solicitação para vender veículo particular.",
      line("Veículo", [text(body, "brand", 80), text(body, "model", 100), text(body, "version", 140)].filter(Boolean).join(" ")),
      line("Ano", text(body, "year", 20)),
      line("Km", text(body, "mileage", 30)),
      line("Valor pretendido", text(body, "targetPrice", 40)),
      line("Cidade", text(body, "city", 100)),
      line("Situação", list(body, "vehicleStatus")),
      line("Fotos/links", text(body, "photoLinks", 1200)),
      line("Observações", fallback),
    ].filter(Boolean).join("\n");
  }
  if (kind === "partner" || kind === "wholesale") {
    return [
      kind === "partner" ? "Solicitação de parceria Autodrive." : "Solicitação de cadastro para compras no atacado.",
      line("Razão social", text(body, "companyName", 160)),
      line("Nome fantasia", text(body, "tradeName", 160)),
      line("CNPJ", text(body, "cnpj", 30)),
      line("Responsável", text(body, "name", 120)),
      line("Cidade", text(body, "city", 100)),
      line("Estoque médio", text(body, "averageInventory", 30)),
      line("Sistema atual", text(body, "currentSystem", 120)),
      line("Interesses", list(body, "desiredWork")),
      line("Observações", fallback),
    ].filter(Boolean).join("\n");
  }
  if (kind === "find_car") {
    return [
      "Solicitação do Autodrive Busca.",
      line("Busca", [text(body, "brand", 80), text(body, "model", 100)].filter(Boolean).join(" ")),
      line("Ano mínimo", text(body, "yearMin", 4)),
      line("Orçamento", text(body, "budget", 40)),
      line("Entrada", text(body, "downPayment", 40)),
      line("Possui troca", text(body, "hasTrade", 20)),
      line("Pretende financiar", text(body, "wantsFinancing", 30)),
      line("Observações", fallback),
    ].filter(Boolean).join("\n");
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 100_000) return NextResponse.json({ error: "Solicitação muito grande" }, { status: 413 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Preencha corretamente todos os campos obrigatórios." }, { status: 400 });

  const name = text(body, "name", 160);
  const phone = text(body, "phone", 30);
  const email = text(body, "email", 254);
  const message = text(body, "message", 2000);
  const kind = text(body, "kind", 40);
  const companyName = text(body, "companyName", 160);
  const tradeName = text(body, "tradeName", 160);
  const cnpj = text(body, "cnpj", 30);
  const emailIsValid = email === "" || (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const phoneDigits = phone.replace(/\D/g, "");
  const isWholesale = kind === "wholesale";
  const isPartner = kind === "partner";
  const isFindCar = kind === "find_car";
  const isSellCar = kind === "sell_car";
  const resolvedName = isWholesale ? companyName : name;
  const normalizedCnpj = (isWholesale || isPartner) ? formatCnpj(cnpj) : null;
  const structuredPayload = leadPayload(body);
  const resolvedMessage = buildMessage(kind, body, message).slice(0, 5000);
  const baseIsInvalid = !kinds.has(kind) || resolvedName.length < 2 || resolvedName.length > 160 || phone.length > 30 || phoneDigits.length < 10 || phoneDigits.length > 13 || !emailIsValid || resolvedMessage.length < 2 || body.consent !== "yes";
  if (baseIsInvalid) return NextResponse.json({ error: "Preencha corretamente todos os campos obrigatórios." }, { status: 400 });
  if (isWholesale && (!email || !isValidCnpj(cnpj))) return NextResponse.json({ error: "Informe um CNPJ válido e um e-mail válido." }, { status: 400 });
  if (isPartner && (!email || !companyName || !text(body, "city", 100) || !isValidCnpj(cnpj))) return NextResponse.json({ error: "Informe os dados obrigatórios da empresa e um CNPJ válido." }, { status: 400 });
  if (isSellCar && (!text(body, "city", 100) || !text(body, "brand", 80) || !text(body, "model", 100) || !text(body, "year", 20) || !text(body, "mileage", 30) || !text(body, "targetPrice", 40))) return NextResponse.json({ error: "Informe os dados principais do veículo." }, { status: 400 });
  if (isFindCar && (!text(body, "brand", 80) || !text(body, "model", 100) || !text(body, "budget", 40))) return NextResponse.json({ error: "Informe marca, modelo e orçamento." }, { status: 400 });

  let partnerId: string | null = null;
  if (isPartner) {
    const averageInventory = Number.parseInt(text(body, "averageInventory", 20).replace(/\D/g, ""), 10);
    const partner = await query<{ id: string }>(
      `insert into partners(source_id, external_id, name, legal_name, cnpj, responsible_name, whatsapp, email, city, address, instagram, website, average_inventory, current_system, desired_work, notes, active, updated_at)
       values('site_partner_form', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, false, now())
       on conflict (source_id, external_id) do update set
         name=excluded.name,
         legal_name=excluded.legal_name,
         cnpj=excluded.cnpj,
         responsible_name=excluded.responsible_name,
         whatsapp=excluded.whatsapp,
         email=excluded.email,
         city=excluded.city,
         address=excluded.address,
         instagram=excluded.instagram,
         website=excluded.website,
         average_inventory=excluded.average_inventory,
         current_system=excluded.current_system,
         desired_work=excluded.desired_work,
         notes=excluded.notes,
         updated_at=now()
       returning id`,
      [
        normalizedCnpj?.replace(/\D/g, ""),
        tradeName || companyName,
        companyName,
        normalizedCnpj,
        name,
        phone,
        email,
        text(body, "city", 100),
        text(body, "address", 220) || null,
        text(body, "instagram", 120) || null,
        text(body, "website", 180) || null,
        Number.isFinite(averageInventory) ? averageInventory : null,
        text(body, "currentSystem", 120) || null,
        JSON.stringify(list(body, "desiredWork")),
        message,
      ],
    );
    partnerId = partner.rows[0]?.id ?? null;
  }

  const vehicleOriginType = normalizeVehicleOrigin(text(body, "vehicleOriginType", 30));
  const inserted = await query<{ id: string }>(
    `insert into leads(kind, name, company_name, cnpj, email, phone, message, consent_at, lead_source, campaign, utm_source, utm_medium, utm_campaign, page_url, vehicle_origin_type, partner_id, payload)
     values ($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     returning id`,
    [
      kind,
      resolvedName,
      (isWholesale || isPartner) ? companyName : null,
      normalizedCnpj,
      email || null,
      phone,
      resolvedMessage,
      text(body, "leadSource", 80) || "site",
      text(body, "campaign", 120) || text(body, "utmCampaign", 120) || null,
      text(body, "utmSource", 120) || null,
      text(body, "utmMedium", 120) || null,
      text(body, "utmCampaign", 120) || null,
      text(body, "pageUrl", 500) || null,
      vehicleOriginType,
      partnerId,
      JSON.stringify(structuredPayload),
    ],
  );
  try {
    await sendLeadNotification({
      id: inserted.rows[0].id,
      kind: kind as "contact" | "financing" | "sell_car" | "wholesale" | "partner" | "find_car" | "vehicle_interest",
      name: resolvedName,
      email,
      phone,
      message: resolvedMessage,
      companyName: (isWholesale || isPartner) ? companyName : undefined,
      cnpj: normalizedCnpj || undefined,
      details: structuredPayload,
    });
  } catch (error) {
    console.error("Falha ao notificar novo lead por SMTP", safeMailError(error));
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
