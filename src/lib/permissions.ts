import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { currentSession, type AuthSession } from "@/lib/auth";
import { query } from "@/lib/db";

export { AREAS, canAccess, ROLE_AREAS, ROLES, type Area, type Role } from "@/lib/permissions-shared";
import { canAccess, ROLES, type Area, type Role } from "@/lib/permissions-shared";

export type AdminUser = { id: string; email: string; name: string | null; role: Role; mustChangePassword: boolean; session: AuthSession };

/** Usuário da sessão, se estiver ativo. */
export async function currentAdmin(): Promise<AdminUser | null> {
  const session = await currentSession();
  if (!session) return null;
  const row = await query<{ id: string; email: string; name: string | null; role: string; active: boolean; must_change_password: boolean }>(
    "select id, email, name, role, active, must_change_password from users where id=$1 limit 1",
    [session.userId],
  ).then((r) => r.rows[0]).catch(() =>
    // Sem a migration 022 a coluna name ainda não existe.
    query<{ id: string; email: string; name: null; role: string; active: boolean; must_change_password: boolean }>(
      "select id, email, null as name, role, active, must_change_password from users where id=$1 limit 1",
      [session.userId],
    ).then((r) => r.rows[0]),
  );
  if (!row?.active) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: (row.role in ROLES ? row.role : "editor") as Role,
    mustChangePassword: row.must_change_password,
    session,
  };
}

/** Para páginas: sem login vai para o login; sem permissão volta ao dashboard. */
export async function requireArea(area: Area): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  // Senha temporária (usuário novo ou senha redefinida): troca antes de usar o painel.
  if (user.mustChangePassword) redirect("/admin/trocar-senha?obrigatorio=1");
  if (!canAccess(user.role, area)) redirect("/admin?sem-permissao=1");
  return user;
}

/** Para rotas de API: devolve o usuário ou a resposta de erro pronta. */
export async function apiArea(area: Area): Promise<{ user: AdminUser; error?: never } | { user?: never; error: NextResponse }> {
  const user = await currentAdmin();
  if (!user) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  if (!canAccess(user.role, area)) return { error: NextResponse.json({ error: "Seu perfil não tem acesso a esta área." }, { status: 403 }) };
  return { user };
}

/**
 * Substituto direto de currentSession() nas rotas de API do painel: devolve a
 * sessão só se o usuário está ativo e o perfil dele acessa a área. Assim as
 * rotas antigas ganham RBAC trocando uma chamada, sem mudar o resto.
 */
export async function sessionFor(area: Area): Promise<AuthSession | null> {
  const user = await currentAdmin();
  return user && canAccess(user.role, area) ? user.session : null;
}
