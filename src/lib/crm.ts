/** Dados do CRM de leads. SOMENTE SERVIDOR (importa lib/db). */
import { query } from "@/lib/db";

export type CrmVehicle = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  image_url: string | null;
  code: string | null;
  year: string;
  mileage: number | null;
  status: string;
};

export type CrmCard = {
  id: string;
  kind: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  stage_changed_at: string | null;
  scheduled_at: string | null;
  tags: string[];
  assigned_to: string | null;
  lead_source: string | null;
  utm_source: string | null;
  payment_method: string | null;
  has_trade: string | null;
  intent: string | null;
  financing_service: string | null;
  vehicle: CrmVehicle | null;
};

export type CrmActivity = { id: string; created_at: string; type: string; text: string; user_name: string | null };

export type CrmLeadDetail = CrmCard & {
  message: string;
  notes: string | null;
  lost_reason: string | null;
  page_url: string | null;
  utm_campaign: string | null;
  company_name: string | null;
  cnpj: string | null;
  payload: Record<string, unknown>;
  activities: CrmActivity[];
};

const VEHICLE_JSON = `case when v.id is null then null else json_build_object(
  'id', v.id, 'title', v.title, 'slug', v.slug, 'price_cents', v.price_cents, 'image_url', v.image_url,
  'code', coalesce(nullif(v.internal_code, ''), v.catalog_item_id), 'year', concat_ws('/', v.year_make, v.year_model),
  'mileage', v.mileage, 'status', v.status) end`;

const CARD_COLUMNS = `l.id, l.kind, l.name, l.phone, l.email, l.status, l.created_at, l.updated_at, l.stage_changed_at, l.scheduled_at,
  l.tags, l.assigned_to, l.lead_source, l.utm_source,
  l.payload->>'paymentMethod' as payment_method, l.payload->>'hasTrade' as has_trade, l.payload->>'intent' as intent,
  l.payload->>'financingService' as financing_service,
  ${VEHICLE_JSON} as vehicle`;

export type BoardFilters = { q?: string; kind?: string; owner?: string; tag?: string };

/** Leads do quadro: tudo que está aberto + finalizados dos últimos 60 dias. */
export async function loadBoard(filters: BoardFilters) {
  const params: unknown[] = [];
  const where = [
    "l.status <> 'archived'",
    "(l.status not in ('converted','lost') or coalesce(l.stage_changed_at, l.updated_at, l.created_at) >= now() - interval '60 days')",
  ];
  const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replaceAll("?", `$${params.length}`)); };
  if (filters.q) add("(l.name ilike ? or l.phone ilike ? or l.email ilike ? or v.title ilike ?)", `%${filters.q}%`);
  if (filters.kind) add("l.kind = ?", filters.kind);
  if (filters.owner === "none") where.push("l.assigned_to is null");
  else if (filters.owner) add("l.assigned_to = ?", filters.owner);
  if (filters.tag) add("? = any(l.tags)", filters.tag);
  const result = await query<CrmCard>(
    `select ${CARD_COLUMNS} from leads l left join vehicles v on v.id = l.vehicle_id
     where ${where.join(" and ")}
     order by coalesce(l.stage_changed_at, l.created_at) desc limit 600`,
    params,
  );
  return result.rows;
}

export async function loadLeadDetail(id: string): Promise<CrmLeadDetail | null> {
  const lead = await query<Omit<CrmLeadDetail, "activities">>(
    `select ${CARD_COLUMNS}, l.message, l.notes, l.lost_reason, l.page_url, l.utm_campaign, l.company_name, l.cnpj, l.payload
     from leads l left join vehicles v on v.id = l.vehicle_id where l.id = $1`,
    [id],
  );
  if (!lead.rows[0]) return null;
  const activities = await query<CrmActivity>(
    `select a.id::text, a.created_at, a.type, a.text, coalesce(nullif(u.name, ''), u.email) as user_name
     from lead_activities a left join users u on u.id = a.user_id where a.lead_id = $1 order by a.created_at desc limit 200`,
    [id],
  ).then((r) => r.rows).catch(() => []);
  return { ...lead.rows[0], activities };
}

export async function logActivity(leadId: string, userId: string | null, type: string, text: string, metadata: Record<string, unknown> = {}) {
  await query(
    "insert into lead_activities(lead_id, user_id, type, text, metadata) values ($1,$2,$3,$4,$5::jsonb)",
    [leadId, userId, type, text.slice(0, 5000), JSON.stringify(metadata)],
  );
}

export async function listTags() {
  return query<{ tag: string }>("select distinct unnest(tags) as tag from leads order by 1 limit 100")
    .then((r) => r.rows.map((row) => row.tag)).catch(() => [] as string[]);
}

export async function listUsers() {
  return query<{ id: string; label: string }>("select id, coalesce(nullif(name,''), email) as label from users where active order by label")
    .then((r) => r.rows).catch(() => [] as { id: string; label: string }[]);
}
