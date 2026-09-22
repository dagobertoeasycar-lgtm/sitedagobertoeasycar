import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit, diff } from "@/lib/audit";
import { apiArea, ROLES } from "@/lib/permissions";

/**
 * Edita perfil, nome e situação, ou define uma nova senha temporária.
 * Ninguém tira o próprio acesso de administrador nem se desativa: evita
 * que o painel fique sem nenhum administrador por engano.
 * PATCH /api/admin/users/{id} { name?, role?, active?, password? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiArea("usuarios");
  if (guard.error) return guard.error;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await request.json().catch(() => null) as { name?: string; role?: string; active?: boolean; password?: string } | null;
  if (!body) return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });

  const current = await query<{ name: string | null; role: string; active: boolean; email: string }>(
    "select name, role, active, email from users where id=$1",
    [id],
  );
  const before = current.rows[0];
  if (!before) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const self = id === guard.user.id;

  const after: Record<string, unknown> = {};
  if (body.name !== undefined) after.name = String(body.name).trim().slice(0, 120) || null;
  if (body.role !== undefined) {
    if (!(body.role in ROLES)) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
    if (self && body.role !== "admin") return NextResponse.json({ error: "Você não pode tirar o seu próprio acesso de administrador." }, { status: 400 });
    after.role = body.role;
  }
  if (body.active !== undefined) {
    if (self && !body.active) return NextResponse.json({ error: "Você não pode desativar a sua própria conta." }, { status: 400 });
    after.active = Boolean(body.active);
  }

  const sets = Object.keys(after).map((column, index) => `${column}=$${index + 1}`);
  const values = Object.values(after);
  let passwordChanged = false;
  if (body.password !== undefined) {
    if (String(body.password).length < 14) return NextResponse.json({ error: "A senha temporária precisa ter ao menos 14 caracteres." }, { status: 400 });
    const salt = randomBytes(24).toString("hex");
    values.push(hashPassword(String(body.password), salt), salt);
    sets.push(`password_hash=$${values.length - 1}`, `password_salt=$${values.length}`, "must_change_password=true");
    passwordChanged = true;
  }
  if (!sets.length) return NextResponse.json({ id, changed: {} });

  // Continua existindo pelo menos um administrador ativo.
  if ((after.role && after.role !== "admin") || after.active === false) {
    const admins = await query<{ total: number }>("select count(*)::int as total from users where role='admin' and active and id<>$1", [id]);
    if (before.role === "admin" && (admins.rows[0]?.total ?? 0) === 0) {
      return NextResponse.json({ error: "É preciso manter pelo menos um administrador ativo." }, { status: 400 });
    }
  }

  values.push(id);
  await query(`update users set ${sets.join(", ")}, updated_at=now() where id=$${values.length}`, values);
  const changed = diff(before, after);
  await audit(guard.user.id, passwordChanged ? "redefinir_senha" : "editar", "user", id, { email: before.email, changed, senha: passwordChanged }, request);
  return NextResponse.json({ id, changed, passwordChanged });
}
