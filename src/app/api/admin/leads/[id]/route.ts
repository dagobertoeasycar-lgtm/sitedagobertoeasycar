import { NextRequest, NextResponse } from "next/server";
import { apiArea } from "@/lib/permissions";
import { query } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { LEAD_STATUS_LABELS } from "@/lib/admin-labels";
import { loadLeadDetail, logActivity } from "@/lib/crm";

/**
 * CRM do lead.
 * GET    → ficha completa com histórico
 * PATCH  → etapa, responsável, contato, carro, negociação, agendamento, etiquetas, anotação
 * DELETE → apaga de vez (só administrador)
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEAL_FIELDS: Record<string, string> = {
  paymentMethod: "Forma de pagamento",
  downPayment: "Entrada",
  installments: "Prazo",
  hasTrade: "Carro na troca",
  tradeVehicle: "Veículo da troca",
  tradeYear: "Ano da troca",
  tradeMileage: "Km da troca",
};

type Current = {
  status: string; assigned_to: string | null; notes: string | null; name: string; phone: string; email: string | null;
  vehicle_id: string | null; scheduled_at: Date | null; tags: string[]; lost_reason: string | null; payload: Record<string, unknown>;
};

function when(date: Date) {
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiArea("leads");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const lead = await loadLeadDetail(id).catch(() => null);
  if (!lead) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiArea("leads");
  if (guard.error) return guard.error;
  const userId = guard.user.id;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const current = await query<Current>(
    "select status, assigned_to, notes, name, phone, email, vehicle_id, scheduled_at, tags, lost_reason, payload from leads where id=$1",
    [id],
  ).catch(() => null);
  if (!current) return NextResponse.json({ error: "Rode npm run db:migrate (migration 024) para usar o CRM." }, { status: 503 });
  const before = current.rows[0];
  if (!before) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

  const set: Record<string, unknown> = {};
  const activities: { type: string; text: string; metadata?: Record<string, unknown> }[] = [];

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!(status in LEAD_STATUS_LABELS)) return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
    if (status !== before.status) {
      set.status = status;
      set.stage_changed_at = new Date();
      activities.push({ type: "stage", text: `Moveu de “${LEAD_STATUS_LABELS[before.status] ?? before.status}” para “${LEAD_STATUS_LABELS[status]}”`, metadata: { from: before.status, to: status } });
    }
  }

  if (body.assignedTo !== undefined) {
    const assignee = body.assignedTo ? String(body.assignedTo) : null;
    if (assignee && !UUID_RE.test(assignee)) return NextResponse.json({ error: "Responsável inválido" }, { status: 400 });
    if (assignee !== before.assigned_to) {
      set.assigned_to = assignee;
      const label = assignee ? await query<{ label: string }>("select coalesce(nullif(name,''), email) as label from users where id=$1", [assignee]).then((r) => r.rows[0]?.label).catch(() => null) : null;
      activities.push({ type: "edit", text: assignee ? `Responsável: ${label ?? "usuário"}` : "Responsável removido" });
    }
  }

  const contactChanges: string[] = [];
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 160);
    if (name.length < 2) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
    if (name !== before.name) { set.name = name; contactChanges.push("nome"); }
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone).trim().slice(0, 30);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
    if (phone !== before.phone) { set.phone = phone; contactChanges.push("telefone"); }
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase().slice(0, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    if ((email || null) !== before.email) { set.email = email || null; contactChanges.push("e-mail"); }
  }
  if (contactChanges.length) activities.push({ type: "edit", text: `Alterou ${contactChanges.join(", ")}` });

  if (body.vehicleId !== undefined) {
    const vehicleId = body.vehicleId ? String(body.vehicleId) : null;
    if (vehicleId && !UUID_RE.test(vehicleId)) return NextResponse.json({ error: "Veículo inválido" }, { status: 400 });
    if (vehicleId !== before.vehicle_id) {
      let title = "";
      if (vehicleId) {
        const vehicle = await query<{ title: string; catalog_item_id: string; origin_type: string | null }>("select title, catalog_item_id, origin_type from vehicles where id=$1", [vehicleId]);
        if (!vehicle.rows[0]) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });
        title = `${vehicle.rows[0].title} (${vehicle.rows[0].catalog_item_id})`;
        set.vehicle_origin_type = vehicle.rows[0].origin_type;
      }
      set.vehicle_id = vehicleId;
      activities.push({ type: "vehicle", text: vehicleId ? `Carro de interesse: ${title}` : "Carro de interesse removido" });
    }
  }

  if (body.scheduledAt !== undefined) {
    const raw = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
    if (raw && Number.isNaN(raw.getTime())) return NextResponse.json({ error: "Data de agendamento inválida" }, { status: 400 });
    if ((raw?.getTime() ?? null) !== (before.scheduled_at ? new Date(before.scheduled_at).getTime() : null)) {
      set.scheduled_at = raw;
      activities.push({ type: "schedule", text: raw ? `Agendou para ${when(raw)}` : "Removeu o agendamento" });
      // Agendar a partir do início do funil já move o card para "Visita agendada".
      if (raw && set.status === undefined && ["new", "contacted", "qualified"].includes(before.status)) {
        set.status = "scheduled";
        set.stage_changed_at = new Date();
        activities.push({ type: "stage", text: `Moveu de “${LEAD_STATUS_LABELS[before.status]}” para “${LEAD_STATUS_LABELS.scheduled}”`, metadata: { from: before.status, to: "scheduled" } });
      }
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return NextResponse.json({ error: "Etiquetas inválidas" }, { status: 400 });
    const tags = [...new Set(body.tags.map((tag) => String(tag).trim().slice(0, 30)).filter(Boolean))].slice(0, 12);
    if (JSON.stringify(tags) !== JSON.stringify(before.tags ?? [])) {
      set.tags = tags;
      activities.push({ type: "tags", text: tags.length ? `Etiquetas: ${tags.join(", ")}` : "Removeu as etiquetas" });
    }
  }

  if (body.lostReason !== undefined) {
    const reason = String(body.lostReason ?? "").trim().slice(0, 200) || null;
    if (reason !== before.lost_reason) {
      set.lost_reason = reason;
      if (reason) activities.push({ type: "edit", text: `Motivo do insucesso: ${reason}` });
    }
  }

  if (body.deal !== undefined) {
    if (!body.deal || typeof body.deal !== "object") return NextResponse.json({ error: "Negociação inválida" }, { status: 400 });
    const deal = body.deal as Record<string, unknown>;
    const payload = { ...(before.payload ?? {}) };
    const changed: string[] = [];
    for (const [key, label] of Object.entries(DEAL_FIELDS)) {
      if (deal[key] === undefined) continue;
      const value = String(deal[key] ?? "").trim().slice(0, 160);
      if (value === String(payload[key] ?? "")) continue;
      if (value) payload[key] = value; else delete payload[key];
      changed.push(label.toLowerCase());
    }
    if (changed.length) {
      set.payload = JSON.stringify(payload);
      activities.push({ type: "edit", text: `Alterou negociação: ${changed.join(", ")}` });
    }
  }

  // Campo antigo de anotação única (lista de leads) continua funcionando.
  if (body.notes !== undefined) {
    const notes = String(body.notes).slice(0, 5000);
    if (notes !== (before.notes ?? "")) {
      set.notes = notes;
      if (notes.trim()) activities.push({ type: "note", text: notes.trim() });
    }
  }
  if (body.note !== undefined) {
    const note = String(body.note).trim().slice(0, 5000);
    if (!note) return NextResponse.json({ error: "Escreva a anotação." }, { status: 400 });
    activities.push({ type: "note", text: note });
  }

  if (Object.keys(set).length) {
    const columns = Object.keys(set);
    await query(
      `update leads set ${columns.map((column, index) => `${column}=$${index + 1}${column === "payload" ? "::jsonb" : ""}`).join(", ")}, updated_at=now() where id=$${columns.length + 1}`,
      [...columns.map((column) => set[column]), id],
    );
  }
  for (const activity of activities) await logActivity(id, userId, activity.type, activity.text, activity.metadata);
  if (Object.keys(set).length) {
    const auditable = Object.fromEntries(Object.entries(set).filter(([key]) => key !== "payload" && key !== "stage_changed_at"));
    await audit(userId, "atendimento", "lead", id, { changed: diff(before as unknown as Record<string, unknown>, auditable) }, request);
  }

  const lead = await loadLeadDetail(id);
  return NextResponse.json(lead);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiArea("leads");
  if (guard.error) return guard.error;
  if (guard.user.role !== "admin") return NextResponse.json({ error: "Só administradores podem apagar leads. Use Arquivar." }, { status: 403 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const removed = await query<{ name: string; phone: string; kind: string }>("delete from leads where id=$1 returning name, phone, kind", [id]);
  if (!removed.rows[0]) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  await audit(guard.user.id, "delete", "lead", id, { ...removed.rows[0] }, request);
  return NextResponse.json({ ok: true });
}
