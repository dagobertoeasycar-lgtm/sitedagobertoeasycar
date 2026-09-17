import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizePartnerOriginKind, validatePartnerInput, type PartnerInput } from "@/lib/partners";

const UUID = /^[0-9a-f-]{36}$/;

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
  };
}

/**
 * PATCH aceita dois formatos:
 *   { active: boolean }  → só liga/desliga o parceiro (switch da listagem)
 *   { name, ... }        → edição completa do cadastro
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;

  if (Object.keys(body).length === 1 && typeof body.active === "boolean") {
    const result = await query<{ id: string; active: boolean }>(
      "UPDATE partners SET active = $1, updated_at = now() WHERE id = $2 RETURNING id, active",
      [body.active, id],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });
    await query(
      "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'status','partner',$2,$3::jsonb)",
      [session.userId, id, JSON.stringify({ active: body.active })],
    );
    return NextResponse.json({ id, active: result.rows[0].active });
  }

  const input = readBody(body);
  const problem = validatePartnerInput(input);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const result = await query<{ id: string }>(
    `UPDATE partners SET
       name = $1, trade_name = $2, legal_name = $3, cnpj = $4, phone = $5,
       whatsapp = $6, email = $7, city = $8, stock_url = $9, stock_url_alt = $10,
       origin_kind = $11, notes = $12, updated_at = now()
     WHERE id = $13
     RETURNING id`,
    [
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
      id,
    ],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });

  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'update','partner',$2,$3::jsonb)",
    [session.userId, id, JSON.stringify({ name: input.name })],
  );
  return NextResponse.json({ id });
}

/**
 * Exclusão só é permitida quando o parceiro não tem veículo vinculado.
 * Com estoque vinculado, o caminho correto é desativar — assim o histórico
 * de leads e de preço não fica órfão.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const linked = await query<{ total: number }>(
    "SELECT count(*)::int AS total FROM vehicles WHERE partner_id = $1",
    [id],
  );
  const total = linked.rows[0]?.total ?? 0;
  if (total > 0) {
    return NextResponse.json(
      {
        error: `Este parceiro tem ${total} veículo(s) vinculado(s). Desative-o em vez de excluir, para preservar o histórico.`,
      },
      { status: 409 },
    );
  }

  const result = await query<{ id: string }>("DELETE FROM partners WHERE id = $1 RETURNING id", [id]);
  if (!result.rowCount) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });

  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES($1,'delete','partner',$2)",
    [session.userId, id],
  );
  return NextResponse.json({ id });
}
