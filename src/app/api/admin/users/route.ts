import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { apiArea, ROLES } from "@/lib/permissions";

/**
 * Cria um usuário do painel. A senha inicial é temporária: no primeiro acesso
 * a pessoa é obrigada a trocar (must_change_password).
 * POST /api/admin/users { email, name, role, password }
 */
export async function POST(request: NextRequest) {
  const guard = await apiArea("usuarios");
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => null) as { email?: string; name?: string; role?: string; password?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim().slice(0, 120);
  const role = String(body?.role ?? "");
  const password = String(body?.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  if (!(role in ROLES)) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  if (password.length < 14) return NextResponse.json({ error: "A senha temporária precisa ter ao menos 14 caracteres." }, { status: 400 });

  const salt = randomBytes(24).toString("hex");
  try {
    const result = await query<{ id: string }>(
      "insert into users(email, name, role, password_hash, password_salt, must_change_password) values($1,$2,$3,$4,$5,true) returning id",
      [email, name || null, role, hashPassword(password, salt), salt],
    );
    const id = result.rows[0].id;
    await audit(guard.user.id, "criar", "user", id, { email, role }, request);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/users_email_key|duplicate/.test(message)) return NextResponse.json({ error: "Já existe um usuário com esse e-mail." }, { status: 409 });
    if (/column "name"|users_role_check/.test(message)) return NextResponse.json({ error: "Rode npm run db:migrate (migration 022) antes de criar usuários." }, { status: 503 });
    throw error;
  }
}
