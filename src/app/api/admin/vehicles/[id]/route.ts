import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { coerceField, VEHICLE_FIELDS } from "@/lib/admin-vehicle";

const statuses = ["draft", "published", "paused", "sold"];
const stockStatuses = ["available", "reserved", "sold"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await request.json() as { status?: string; stockStatus?: string };
  if (!body.status || !statuses.includes(body.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  if (!body.stockStatus || !stockStatuses.includes(body.stockStatus)) return NextResponse.json({ error: "Disponibilidade inválida" }, { status: 400 });
  const result = await query<{ id: string }>("update vehicles set status=$1,stock_status=$2,updated_at=now() where id=$3 returning id", [body.status, body.stockStatus, id]);
  if (!result.rowCount) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  await query("insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,'status','vehicle',$2,$3::jsonb)", [session.userId, id, JSON.stringify({ status: body.status, stockStatus: body.stockStatus })]);
  return NextResponse.json({ id, status: body.status, stockStatus: body.stockStatus });
}

/**
 * Grava o editor completo do anúncio (abas do painel novo).
 *
 * Em veículo importado de parceiro, os campos que a sincronização reescreve
 * são ignorados com aviso: gravar ali só faria a alteração sumir no próximo
 * ciclo. O resto (destaque, SEO, notas, publicação) vale para qualquer origem.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const columns = VEHICLE_FIELDS.map((field) => field.column);
  const current = await query<Record<string, unknown>>(
    `select source_id, status, stock_status, ${columns.join(", ")} from vehicles where id=$1`,
    [id],
  ).catch(async () => {
    // Sem a migration 022 as colunas de SEO não existem; edita o resto.
    return query<Record<string, unknown>>(
      `select source_id, status, stock_status, ${columns.filter((c) => !c.startsWith("seo_")).join(", ")} from vehicles where id=$1`,
      [id],
    );
  });
  const before = current.rows[0];
  if (!before) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const synced = Boolean(before.source_id);

  const sets: string[] = [];
  const values: unknown[] = [];
  const after: Record<string, unknown> = {};
  const ignored: string[] = [];
  for (const field of VEHICLE_FIELDS) {
    if (!(field.key in body)) continue;
    if (!(field.column in before)) continue;
    if (synced && field.syncOwned) { ignored.push(field.key); continue; }
    const parsed = coerceField(field, body[field.key]);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    values.push(field.type === "list" ? JSON.stringify(parsed.value) : parsed.value);
    sets.push(`${field.column}=$${values.length}${field.type === "list" ? "::jsonb" : ""}`);
    after[field.column] = parsed.value;
  }

  if (!synced && "title" in after && !String(after.title ?? "").trim()) {
    return NextResponse.json({ error: "O título é obrigatório." }, { status: 400 });
  }

  if (typeof body.status === "string") {
    if (!statuses.includes(body.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    values.push(body.status); sets.push(`status=$${values.length}`); after.status = body.status;
  }
  if (typeof body.stockStatus === "string") {
    if (!stockStatuses.includes(body.stockStatus)) return NextResponse.json({ error: "Disponibilidade inválida" }, { status: 400 });
    values.push(body.stockStatus); sets.push(`stock_status=$${values.length}`); after.stock_status = body.stockStatus;
  }
  if (!sets.length) return NextResponse.json({ id, changed: {}, ignored });

  values.push(id);
  await query(`update vehicles set ${sets.join(", ")}, updated_at=now() where id=$${values.length}`, values);
  const changed = diff(before, after);
  if (Object.keys(changed).length) await audit(session.userId, "editar", "vehicle", id, { changed, ignored }, request);
  return NextResponse.json({ id, changed, ignored });
}

/**
 * Exclui o veículo de vez.
 *
 * Veículo que veio de parceiro precisa entrar na lista de bloqueio antes de
 * sumir, senão a sincronização o traz de volta publicado no ciclo seguinte
 * (o upsert força status='published'). Ver migration 017.
 *
 * DELETE /api/admin/vehicles/{id}?motivo=texto
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const alvo = await query<{ id: string; title: string; source_id: string | null; external_id: string | null }>(
    "select id, title, source_id, external_id from vehicles where id=$1 limit 1",
    [id],
  );
  const v = alvo.rows[0];
  if (!v) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const motivo = (new URL(request.url).searchParams.get("motivo") || "").slice(0, 300);
  let bloqueado = false;

  if (v.source_id && v.external_id) {
    try {
      await query(
        `insert into vehicle_blocklist(source_id, external_id, titulo, motivo, bloqueado_por)
         values ($1,$2,$3,$4,$5)
         on conflict (source_id, external_id) do update set
           motivo = excluded.motivo, bloqueado_por = excluded.bloqueado_por, created_at = now()`,
        [v.source_id, v.external_id, v.title, motivo, session.userId],
      );
      bloqueado = true;
    } catch (error) {
      // Sem a migration 017 o bloqueio não existe. Excluir mesmo assim seria
      // enganoso: em 15 minutos o carro volta. Melhor dizer o que falta.
      const falha = error instanceof Error ? error.message : "erro desconhecido";
      return NextResponse.json(
        { error: `Não foi possível bloquear a reimportação (${falha}). Rode npm run db:migrate e tente de novo.` },
        { status: 503 },
      );
    }
  }

  await query("delete from vehicles where id=$1", [id]);
  await query(
    "insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,'excluir','vehicle',$2,$3::jsonb)",
    [session.userId, id, JSON.stringify({ title: v.title, sourceId: v.source_id, externalId: v.external_id, motivo, bloqueado })],
  ).catch(() => undefined);

  return NextResponse.json({ id, excluido: true, bloqueado });
}
