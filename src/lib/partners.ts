/**
 * Consultas de parceiro. SOMENTE SERVIDOR — importa lib/db, que carrega o
 * driver `pg`. Componente "use client" deve importar de lib/partners-shared.
 */
import { query } from "@/lib/db";
import type { Partner } from "./partners-shared";

export * from "./partners-shared";

export async function listPartners(search = "") {
  const term = search.trim();
  const params: unknown[] = [];
  let where = "";
  if (term) {
    params.push(`%${term}%`);
    where = `WHERE (p.name ILIKE $1 OR p.trade_name ILIKE $1 OR p.legal_name ILIKE $1
                 OR p.city ILIKE $1 OR p.cnpj ILIKE $1 OR p.whatsapp ILIKE $1)`;
  }
  const result = await query<Partner>(
    `SELECT p.*,
            (SELECT count(*)::int FROM vehicles v WHERE v.partner_id = p.id) AS vehicles_total,
            (SELECT count(*)::int FROM vehicles v WHERE v.partner_id = p.id AND v.status = 'published') AS vehicles_published
       FROM partners p
       ${where}
      ORDER BY p.active DESC, p.name ASC`,
    params,
  );
  return result.rows;
}

export async function getPartner(id: string) {
  const result = await query<Partner>("SELECT * FROM partners WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ?? null;
}

/** Parceiros que participam da atualização de estoque. */
export async function listActivePartners() {
  const result = await query<Partner>("SELECT * FROM partners WHERE active = true ORDER BY name ASC");
  return result.rows;
}
