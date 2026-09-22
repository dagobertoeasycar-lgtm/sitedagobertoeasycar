import { notFound } from "next/navigation";
import Link from "next/link";
import { requireArea } from "@/lib/permissions";
import { query } from "@/lib/db";
import { formValue, VEHICLE_FIELDS, type VehicleEditorData } from "@/lib/admin-vehicle";
import { VehicleEditor, type HistoryItem } from "@/components/VehicleEditor";
import { pastaDoParceiro, pastaDoVeiculo, separarFotos } from "@/lib/vehicle-photos";
import { brl } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown> & {
  id: string;
  slug: string;
  source_id: string | null;
  external_id: string | null;
  source_url: string | null;
  origin_type: string;
  partner_name: string | null;
  status: string;
  stock_status: string;
  image_url: string | null;
  images: unknown;
  photos_locked: boolean;
  created_at: Date;
  updated_at: Date;
  last_seen_at: Date | null;
  origin_price_cents: number | null;
  price_markup_cents: number | null;
  plate: string | null;
  store: string | null;
  title: string;
  brand: string;
  model: string;
};

const ACTIONS: Record<string, string> = {
  create: "Anúncio criado",
  editar: "Anúncio editado",
  status: "Publicação alterada",
  duplicar: "Criado a partir de outro anúncio",
  excluir: "Anúncio excluído",
};

async function loadVehicle(id: string) {
  const base = `v.id, v.slug, v.source_id, v.external_id, v.source_url, v.origin_type, p.name as partner_name, v.status,
    v.stock_status, v.image_url, v.images, v.photos_locked, v.created_at, v.updated_at, v.last_seen_at,
    v.origin_price_cents, v.price_markup_cents, v.store, v.internal_code`;
  const columns = VEHICLE_FIELDS.map((field) => `v.${field.column}`);
  const sql = (cols: string[]) => `select ${base}, ${cols.join(", ")} from vehicles v left join partners p on p.id = v.partner_id where v.id=$1`;
  try {
    return (await query<Row>(sql(columns), [id])).rows[0];
  } catch {
    // Sem a migration 022: carrega sem as colunas de SEO.
    return (await query<Row>(sql(columns.filter((c) => !c.includes("seo_"))), [id])).rows[0];
  }
}

async function loadHistory(id: string): Promise<HistoryItem[]> {
  const items: HistoryItem[] = [];
  try {
    const audit = await query<{ created_at: Date; action: string; metadata: Record<string, unknown> | null; email: string | null }>(
      `select a.created_at, a.action, a.metadata, u.email from audit_log a left join users u on u.id = a.actor_id
       where a.entity_type='vehicle' and a.entity_id=$1 order by a.created_at desc limit 50`,
      [id],
    );
    for (const row of audit.rows) {
      const changed = row.metadata?.changed as Record<string, unknown> | undefined;
      items.push({
        when: row.created_at.toISOString(),
        who: row.email ?? "Sistema",
        what: ACTIONS[row.action] ?? row.action,
        detail: changed ? `Campos: ${Object.keys(changed).join(", ")}` : row.metadata?.status ? `Status: ${String(row.metadata.status)}` : undefined,
      });
    }
  } catch { /* sem auditoria */ }
  try {
    const prices = await query<{ created_at: Date; previous_published_price_cents: number | null; new_published_price_cents: number | null; changed_by: string | null }>(
      "select created_at, previous_published_price_cents, new_published_price_cents, changed_by from vehicle_price_history where vehicle_id=$1 order by created_at desc limit 30",
      [id],
    );
    for (const row of prices.rows) {
      items.push({
        when: row.created_at.toISOString(),
        who: row.changed_by ?? "Sincronização",
        what: "Preço alterado",
        detail: `${brl(row.previous_published_price_cents)} → ${brl(row.new_published_price_cents)}`,
      });
    }
  } catch { /* sem histórico de preço */ }
  try {
    const photos = await query<{ created_at: Date; acao: string; fotos_antes: number | null; fotos_depois: number | null; feito_por: string | null }>(
      "select created_at, acao, fotos_antes, fotos_depois, feito_por from vehicle_photo_runs where vehicle_id=$1 order by created_at desc limit 30",
      [id],
    );
    for (const row of photos.rows) {
      items.push({
        when: row.created_at.toISOString(),
        who: row.feito_por ?? "Sistema",
        what: `Fotos: ${row.acao}`,
        detail: row.fotos_antes !== null ? `${row.fotos_antes} → ${row.fotos_depois ?? 0} foto(s)` : undefined,
      });
    }
  } catch { /* sem histórico de fotos */ }
  return items.sort((a, b) => b.when.localeCompare(a.when));
}

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  await requireArea("veiculos");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = await loadVehicle(id);
  if (!row) notFound();
  const history = await loadHistory(id);

  const values: VehicleEditorData["values"] = {};
  for (const field of VEHICLE_FIELDS) if (field.column in row) values[field.key] = formValue(field, row[field.column]);

  const vehicle: VehicleEditorData = {
    id: row.id,
    slug: row.slug,
    sourceId: row.source_id,
    externalId: row.external_id,
    sourceUrl: row.source_url,
    originType: row.origin_type,
    partnerName: row.partner_name ?? (row.store || null),
    status: row.status,
    stockStatus: row.stock_status,
    imageUrl: row.image_url,
    images: row.images,
    photosLocked: row.photos_locked,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
    originPriceCents: row.origin_price_cents,
    markupCents: row.price_markup_cents,
    values,
  };

  const pasta = `${pastaDoVeiculo(row)} - ${pastaDoParceiro(row)}`;

  return (
    <>
      <div className="adm-header">
        <h1>{row.title}</h1>
        <Link href="/admin/veiculos" className="adm-link">← Voltar para anúncios</Link>
      </div>
      <VehicleEditor vehicle={vehicle} history={history} pasta={pasta} fotos={separarFotos(row.images).fotos.length} />
    </>
  );
}
