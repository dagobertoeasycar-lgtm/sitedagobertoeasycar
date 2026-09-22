import { requireArea, AREAS, ROLE_AREAS, ROLES } from "@/lib/permissions";
import { query } from "@/lib/db";
import { UsersAdmin, type UserRow } from "@/components/UsersAdmin";

export const dynamic = "force-dynamic";

type Row = { id: string; email: string; name: string | null; role: string; active: boolean; last_login_at: Date | null; created_at: Date };

export default async function UsersPage() {
  const me = await requireArea("usuarios");
  const full = await query<Row>("select id, email, name, role, active, last_login_at, created_at from users order by active desc, created_at")
    .then((r) => r.rows)
    .catch(() => null);
  // Sem a migration 022 não há nome nem último acesso.
  const migrated = full !== null;
  const rows = full ?? (await query<Row>("select id, email, null as name, role, active, null as last_login_at, created_at from users order by active desc, created_at")).rows;
  const users: UserRow[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    lastLogin: row.last_login_at ? row.last_login_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  }));

  return (
    <>
      <div className="adm-header"><h1>Usuários, permissões e segurança</h1></div>
      {!migrated && <p className="adm-feedback error">Nome, último acesso e os perfis Marketing e Comercial dependem da migração 022 (npm run db:migrate).</p>}

      <section className="adm-card">
        <div className="adm-card-header"><h2>Perfis de acesso</h2></div>
        <div className="ad-roles">
          {Object.entries(ROLES).map(([role, label]) => (
            <div key={role} className="ad-role">
              <strong>{label}</strong>
              <small>{ROLE_AREAS[role as keyof typeof ROLES].map((area) => AREAS[area]).join(" · ")}</small>
            </div>
          ))}
        </div>
        <p className="ad-note" style={{ marginTop: 10 }}>
          Ações importantes (edição de anúncio, exclusão, mudança de usuário, atendimento de lead) ficam registradas em Auditoria
          com usuário, IP, antes e depois.
        </p>
      </section>

      <UsersAdmin users={users} currentUserId={me.id} />
    </>
  );
}
