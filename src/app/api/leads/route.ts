import { after, NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { protocolOf, safeMailError, sendLeadNotification, type LeadKind } from "@/lib/email";
import { getEmailSettings } from "@/lib/email-settings";
import { formatCnpj, isValidCnpj } from "@/lib/cnpj";
import { normalizeVehicleOrigin } from "@/lib/vehicle-origin";
import { imageUploadMaxBytes, saveImageFile } from "@/lib/image-upload";
import { FINANCING_SERVICES, financingValidationError, resolveFinancingService } from "@/lib/financing";

export const runtime = "nodejs";
const kinds = new Set(["contact", "financing", "sell_car", "wholesale", "partner", "find_car", "vehicle_interest"]);
const jsonMaxBytes = 100_000;
const multipartMaxBytes = 45 * 1024 * 1024;
const maxLeadPhotos = 28;

const sellCarPhotoLabels: Record<string, string> = {
  photoDashboard: "Painel",
  photoFrontSeats: "Interno - bancos dianteiros",
  photoRearSeats: "Interno - bancos traseiros",
  photoFront: "Frente",
  photoEngine: "Motor",
  photoRoof: "Teto",
  photoFrontDetails: "Detalhes da frente",
  photoRightSide: "Lateral direita",
  photoRightTires: "Pneus lado direito",
  photoRightDetails: "Detalhes do lado direito",
  photoRear: "Traseira",
  photoRearTrunkOpen: "Traseira com porta-malas aberto",
  photoSpareTire: "Estepe",
  photoSafetyItems: "Itens de segurança",
  photoLeftSide: "Lado esquerdo",
  photoLeftTires: "Pneus lado esquerdo",
  photoLeftDetails: "Detalhes do lado esquerdo",
  photoExtraDetails: "Mais detalhes",
};

const requiredSellCarPhotos = [
  "photoDashboard",
  "photoFrontSeats",
  "photoRearSeats",
  "photoFront",
  "photoEngine",
  "photoRoof",
  "photoRightSide",
  "photoRightTires",
  "photoRear",
  "photoRearTrunkOpen",
  "photoSpareTire",
  "photoSafetyItems",
  "photoLeftSide",
  "photoLeftTires",
];

const payloadKeys = [
  "city", "brand", "model", "version", "year", "yearMin", "mileage", "transmission", "fuel", "plate", "color",
  "targetPrice", "vehicleStatus", "photoLinks", "budget", "downPayment", "hasTrade", "wantsFinancing",
  "financingTarget", "financingService", "selectedVehicleLabel", "desiredVehicle", "installmentGoal",
  "companyName", "tradeName", "cnpj", "address", "instagram", "website", "averageInventory", "currentSystem",
  "desiredWork", "vehicleId", "vehicleTitle", "vehicleOriginType", "leadSource", "campaign", "utmSource",
  "utmMedium", "utmCampaign", "pageUrl", "vehiclePhotos",
  "intent", "paymentMethod", "installments", "tradeVehicle", "tradeYear", "tradeMileage", "visitDate", "visitPeriod",
];

const VEHICLE_INTENTS: Record<string, string> = {
  simulacao: "Simulação de financiamento",
  interesse: "Interesse no veículo",
  visita: "Agendamento de visita",
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VehicleRow = { id: string; title: string; catalog_item_id: string; internal_code: string | null; price_cents: number; image_url: string | null; slug: string; origin_type: string | null };

type LeadPhotoFile = { field: string; label: string; file: File };

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
    if (key === "vehiclePhotos" && Array.isArray(value)) {
      payload[key] = value.slice(0, maxLeadPhotos);
      continue;
    }
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
  const intent = text(body, "intent", 20);
  if (VEHICLE_INTENTS[intent]) {
    const hasTrade = text(body, "hasTrade", 10);
    return [
      `${VEHICLE_INTENTS[intent]}.`,
      line("Veículo", text(body, "vehicleTitle", 220)),
      line("Forma de pagamento", text(body, "paymentMethod", 60)),
      line("Entrada", text(body, "downPayment", 40)),
      line("Prazo desejado", text(body, "installments", 40)),
      line("Carro na troca", hasTrade),
      hasTrade === "Sim" ? line("Veículo da troca", [text(body, "tradeVehicle", 120), text(body, "tradeYear", 12), text(body, "tradeMileage", 20) && `${text(body, "tradeMileage", 20)} km`].filter(Boolean).join(" · ")) : "",
      line("Data preferida para visita", [text(body, "visitDate", 20), text(body, "visitPeriod", 20)].filter(Boolean).join(" · ")),
      line("Observações", fallback),
    ].filter(Boolean).join("\n");
  }
  if (kind === "financing") {
    const financingTarget = text(body, "financingTarget", 40);
    const service = resolveFinancingService(body.financingService, financingTarget);
    return [
      service ? `Solicitação de ${FINANCING_SERVICES[service].label}.` : "Solicitação de financiamento.",
      line("Origem do veículo", service ? FINANCING_SERVICES[service].originLabel : financingTarget),
      line("Veículo", text(body, "selectedVehicleLabel", 220) || text(body, "vehicleTitle", 220) || text(body, "desiredVehicle", 220)),
      line("Entrada aproximada", text(body, "downPayment", 40)),
      line("Parcela desejada", text(body, "installmentGoal", 40)),
      line("Observações", fallback),
    ].filter(Boolean).join("\n");
  }
  if (kind === "sell_car") {
    return [
      "Solicitação para vender veículo particular.",
      line("Veículo", [text(body, "brand", 80), text(body, "model", 100), text(body, "version", 140)].filter(Boolean).join(" ")),
      line("Ano", text(body, "year", 20)),
      line("Km", text(body, "mileage", 30)),
      line("Valor pretendido", text(body, "targetPrice", 40)),
      line("Cidade", text(body, "city", 100)),
      line("Situação", list(body, "vehicleStatus")),
      line("Fotos recebidas", text(body, "photoLinks", 4000)),
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

function appendBodyValue(body: Record<string, unknown>, key: string, value: FormDataEntryValue) {
  const clean = String(value ?? "").trim();
  const current = body[key];
  if (current) body[key] = Array.isArray(current) ? [...current, clean] : [current, clean];
  else body[key] = clean;
}

async function parseBody(request: NextRequest, isMultipart: boolean) {
  if (!isMultipart) {
    return {
      body: await request.json().catch(() => null) as Record<string, unknown> | null,
      photoFiles: [] as LeadPhotoFile[],
    };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return { body: null, photoFiles: [] as LeadPhotoFile[] };
  const body: Record<string, unknown> = {};
  const photoFiles: LeadPhotoFile[] = [];
  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      if (value.size === 0) continue;
      const label = sellCarPhotoLabels[key];
      if (label) photoFiles.push({ field: key, label, file: value });
      continue;
    }
    appendBodyValue(body, key, value);
  }
  return { body, photoFiles };
}

function siteOrigin(body: Record<string, unknown>) {
  const pageUrl = text(body, "pageUrl", 500);
  try {
    if (pageUrl) return new URL(pageUrl).origin;
  } catch {}
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://www.appautodrive.com.br";
}

async function uploadLeadPhotos(photoFiles: LeadPhotoFile[], body: Record<string, unknown>) {
  const origin = siteOrigin(body);
  const uploaded = [];
  for (const photo of photoFiles) {
    const file = await saveImageFile(photo.file);
    const publicUrl = new URL(file.url, origin).toString();
    uploaded.push({
      field: photo.field,
      label: photo.label,
      url: file.url,
      publicUrl,
      filename: file.filename,
      size: file.size,
      contentType: file.contentType,
    });
  }
  return uploaded;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > (isMultipart ? multipartMaxBytes : jsonMaxBytes)) return NextResponse.json({ error: "Solicitação muito grande" }, { status: 413 });
  const { body, photoFiles } = await parseBody(request, isMultipart);
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
  const preliminaryMessage = buildMessage(kind, body, message).slice(0, 5000);
  const baseIsInvalid = !kinds.has(kind) || resolvedName.length < 2 || resolvedName.length > 160 || phone.length > 30 || phoneDigits.length < 10 || phoneDigits.length > 13 || !emailIsValid || preliminaryMessage.length < 2 || body.consent !== "yes";
  if (baseIsInvalid) return NextResponse.json({ error: "Preencha corretamente todos os campos obrigatórios." }, { status: 400 });
  let financingVehicleId: string | null = null;
  if (kind === "financing") {
    const error = financingValidationError(body);
    if (error) return NextResponse.json({ error }, { status: 400 });
    if (body.financingService === "partners") {
      const vehicle = await query<{ id: string; title: string; catalog_item_id: string; partner_id: string | null }>(
        "SELECT id, title, catalog_item_id, partner_id FROM vehicles WHERE id=$1 AND status='published' AND origin_type='PARTNER' LIMIT 1",
        [body.vehicleId],
      );
      if (!vehicle.rows[0]) return NextResponse.json({ error: "Este veículo não está disponível para simulação. Escolha outro veículo de parceiro." }, { status: 400 });
      financingVehicleId = vehicle.rows[0].id;
      body.vehicleTitle = body.selectedVehicleLabel = `${vehicle.rows[0].title} (${vehicle.rows[0].catalog_item_id})`;
      body.vehicleOriginType = "PARTNER";
    } else if (body.financingService === "private") {
      body.vehicleTitle = body.selectedVehicleLabel = text(body, "desiredVehicle", 180);
      body.vehicleOriginType = "PRIVATE";
    }
  }
  const intent = text(body, "intent", 20);
  let pageVehicle: VehicleRow | null = null;
  if (VEHICLE_INTENTS[intent]) {
    if (!email) return NextResponse.json({ error: "Informe um e-mail válido para receber a confirmação." }, { status: 400 });
    const vehicleId = text(body, "vehicleId", 60);
    if (!UUID_RE.test(vehicleId)) return NextResponse.json({ error: "Veículo não identificado. Recarregue a página e tente de novo." }, { status: 400 });
    const found = await query<VehicleRow>(
      "SELECT id, title, catalog_item_id, internal_code, price_cents, image_url, slug, origin_type FROM vehicles WHERE id=$1 AND status='published' LIMIT 1",
      [vehicleId],
    );
    pageVehicle = found.rows[0] ?? null;
    if (!pageVehicle) return NextResponse.json({ error: "Este veículo não está mais disponível. Veja outras opções no estoque." }, { status: 400 });
    financingVehicleId = pageVehicle.id;
    body.vehicleTitle = body.selectedVehicleLabel = `${pageVehicle.title} (${pageVehicle.catalog_item_id})`;
    body.vehicleOriginType = pageVehicle.origin_type ?? "";
    if (text(body, "hasTrade", 10) === "Sim" && !text(body, "tradeVehicle", 120)) return NextResponse.json({ error: "Informe o carro que vai na troca." }, { status: 400 });
  }
  if (isWholesale && (!email || !isValidCnpj(cnpj))) return NextResponse.json({ error: "Informe um CNPJ válido e um e-mail válido." }, { status: 400 });
  if (isPartner && (!email || !companyName || !text(body, "city", 100) || !isValidCnpj(cnpj))) return NextResponse.json({ error: "Informe os dados obrigatórios da empresa e um CNPJ válido." }, { status: 400 });
  if (isSellCar && (!text(body, "city", 100) || !text(body, "brand", 80) || !text(body, "model", 100) || !text(body, "year", 20) || !text(body, "mileage", 30) || !text(body, "targetPrice", 40))) return NextResponse.json({ error: "Informe os dados principais do veículo." }, { status: 400 });
  if (isFindCar && (!text(body, "brand", 80) || !text(body, "model", 100) || !text(body, "budget", 40))) return NextResponse.json({ error: "Informe marca, modelo e orçamento." }, { status: 400 });
  if (isSellCar) {
    const missingPhotos = requiredSellCarPhotos.filter((field) => !photoFiles.some((photo) => photo.field === field));
    if (missingPhotos.length) return NextResponse.json({ error: "Envie as fotos obrigatórias para a pré-avaliação." }, { status: 400 });
    if (photoFiles.length > maxLeadPhotos) return NextResponse.json({ error: "Envie no máximo 28 fotos por pré-avaliação." }, { status: 400 });
    if (photoFiles.some((photo) => photo.file.size > imageUploadMaxBytes)) return NextResponse.json({ error: "Cada foto deve ter até 8 MB." }, { status: 400 });
  }

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

  let leadBody = body;
  if (isSellCar && photoFiles.length) {
    try {
      const vehiclePhotos = await uploadLeadPhotos(photoFiles, body);
      leadBody = {
        ...body,
        vehiclePhotos,
        photoLinks: vehiclePhotos.map((photo) => `${photo.label}: ${photo.publicUrl}`).join("\n"),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar as fotos.";
      return NextResponse.json({ error: message }, { status: message === "Formato não permitido" ? 415 : 400 });
    }
  }

  const structuredPayload = leadPayload(leadBody);
  const resolvedMessage = buildMessage(kind, leadBody, message).slice(0, 5000);
  const vehicleOriginType = normalizeVehicleOrigin(text(body, "vehicleOriginType", 30));
  const inserted = await query<{ id: string }>(
    `insert into leads(kind, name, company_name, cnpj, email, phone, message, consent_at, lead_source, campaign, utm_source, utm_medium, utm_campaign, page_url, vehicle_origin_type, partner_id, payload, vehicle_id)
     values ($1,$2,$3,$4,$5,$6,$7,now(),$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)
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
      financingVehicleId,
    ],
  );
  const leadId = inserted.rows[0].id;
  // O e-mail sai depois da resposta: o cliente não espera o SMTP e uma falha
  // de envio não afeta o lead, que já está salvo e aparece no painel.
  after(async () => {
    try {
      await sendLeadNotification({
        id: leadId,
        kind: kind as LeadKind,
        name: resolvedName,
        email,
        phone,
        message: resolvedMessage,
        companyName: (isWholesale || isPartner) ? companyName : undefined,
        cnpj: normalizedCnpj || undefined,
        details: structuredPayload,
        vehicle: pageVehicle ? { title: pageVehicle.title, priceCents: pageVehicle.price_cents, imageUrl: pageVehicle.image_url, slug: pageVehicle.slug, code: pageVehicle.internal_code || pageVehicle.catalog_item_id } : null,
      });
    } catch (error) {
      console.error("Falha ao notificar novo lead por e-mail", safeMailError(error));
    }
  });
  const mail = await getEmailSettings().then((r) => r.settings).catch(() => null);
  const confirmationEmail = Boolean(email && mail?.enabled && mail.notifyCustomer);
  return NextResponse.json({ ok: true, protocol: protocolOf(leadId), confirmationEmail }, { status: 201 });
}
