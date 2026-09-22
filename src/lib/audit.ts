import type { NextRequest } from "next/server";
import { query } from "@/lib/db";

/**
 * Registra uma ação do painel em audit_log. Guarda quem fez, de qual IP e,
 * em metadata, o antes/depois quando a tela manda. Nunca derruba a ação
 * principal: auditoria que falha vira só um aviso no log do servidor.
 */
export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
  request?: NextRequest,
) {
  const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request?.headers.get("x-real-ip") || null;
  const values = [actorId, action, entityType, entityId, JSON.stringify(metadata)];
  try {
    await query(
      "insert into audit_log(actor_id,action,entity_type,entity_id,metadata,ip) values($1,$2,$3,$4,$5::jsonb,$6)",
      [...values, ip],
    );
  } catch {
    // Sem a migration 022 a coluna ip ainda não existe.
    await query(
      "insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,$2,$3,$4,$5::jsonb)",
      values,
    ).catch((error) => console.warn("[audit] falhou:", error instanceof Error ? error.message : error));
  }
}

/** Só os campos que mudaram, no formato { campo: { antes, depois } }. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { antes: unknown; depois: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changes[key] = { antes: a ?? null, depois: b ?? null };
  }
  return changes;
}
