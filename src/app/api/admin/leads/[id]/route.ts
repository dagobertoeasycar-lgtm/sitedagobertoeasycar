import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { LEAD_STATUS_LABELS } from "@/lib/admin-labels";

/**
 * Atendimento do lead: status, responsável e anotações internas.
 * PATCH /api/admin/leads/{id} { status?, assignedTo?, notes? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await request.json().catch(() => null) as { status?: string; assignedTo?: string | null; notes?: string } | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const current = await query<{ status: string; assigned_to: string | null; notes: string | null }>(
    "select status, assigned_to, notes from leads where id=$1",
    [id],
  ).catch(() => null);
  if (!current) return NextResponse.json({ error: "Rode npm run db:migrate (migration 022) para usar o atendimento de leads." }, { status: 503 });
  const before = current.rows[0];
  if (!before) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const after: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!(body.status in LEAD_STATUS_LABELS)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    after.status = body.status;
  }
  if (body.assignedTo !== undefined) {
    const assignee = body.assignedTo || null;
    if (assignee && !/^[0-9a-f-]{36}$/.test(assignee)) return NextResponse.json({ error: "Responsável inválido" }, { status: 400 });
    after.assigned_to = assignee;
  }
  if (body.notes !== undefined) after.notes = String(body.notes).slice(0, 5000);
  if (!Object.keys(after).length) return NextResponse.json({ id, changed: {} });

  const columns = Object.keys(after);
  await query(
    `update leads set ${columns.map((column, index) => `${column}=$${index + 1}`).join(", ")}, updated_at=now() where id=$${columns.length + 1}`,
    [...columns.map((column) => after[column]), id],
  );
  const changed = diff(before, after);
  if (Object.keys(changed).length) await audit(session.userId, "atendimento", "lead", id, { changed }, request);
  return NextResponse.json({ id, changed });
}
