import Link from "next/link";
import { requireArea } from "@/lib/permissions";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_at: Date;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  email: string | null;
  vehicle_title: string | null;
};

const ACTIONS: Record<string, string> = {
  login: "Entrou no painel",
  create: "Criou",
  criar: "Criou",
  editar: "Editou",
  update: "Alterou",
  status: "Mudou a publicação",
  duplicar: "Duplicou",
  excluir: "Excluiu",
  atendimento: "Atualizou o atendimento",
  redefinir_senha: "Redefiniu a senha",
  change_password: "Trocou a própria senha",
  session_timeout: "Mudou o tempo de sessão",
  video_padrao: "Mudou o vídeo padrão",
};

const ENTITIES: Record<string, string> = {
  vehicle: "Anúncio",
  lead: "Lead",
  user: "Usuário",
  session: "Sessão",
  settings: "Configuração",
  site_setting: "Configuração",
  partner: "Parceiro",
  banner: "Banner",
};

function describe(metadata: Record<string, unknown> | null) {
  if (!metadata) return [];
  const changed = metadata.changed as Record<string, { antes: unknown; depois: unknown }> | undefined;
  if (changed && Object.keys(changed).length) {
    return Object.entries(changed).map(([field, value]) => {
      const show = (v: unknown) => (v === null || v === "" ? "vazio" : typeof v === "object" ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80));
      return `${field}: ${show(value.antes)} → ${show(value.depois)}`;
    });
  }
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== "" && typeof value !== "object")
    .map(([key, value]) => `${key}: ${String(value).slice(0, 80)}`);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireArea("auditoria");
  const sp = await searchParams;
  const filters = { user: sp.user || "", entity: sp.entity || "", action: sp.action || "", period: sp.period || "7d" };
  const page = Math.max(1, parseInt(sp.p || "1") || 1);
  const limit = 50;

  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replace("?", `$${params.length}`)); };
  if (filters.user) add("a.actor_id=?", filters.user);
  if (filters.entity) add("a.entity_type=?", filters.entity);
  if (filters.action) add("a.action=?", filters.action);
  if (filters.period === "today") conditions.push("a.created_at >= current_date");
  if (filters.period === "7d") conditions.push("a.created_at >= now() - interval '7 days'");
  if (filters.period === "30d") conditions.push("a.created_at >= now() - interval '30 days'");
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

  const select = (withIp: boolean) => `select a.id::text, a.created_at, a.action, a.entity_type, a.entity_id, a.metadata,
      ${withIp ? "a.ip" : "null::text as ip"}, u.email, v.title as vehicle_title
    from audit_log a
    left join users u on u.id = a.actor_id
    left join vehicles v on a.entity_type='vehicle' and v.id::text = a.entity_id
    ${where} order by a.created_at desc limit ${limit + 1} offset ${(page - 1) * limit}`;
  const rows = await query<Row>(select(true), params).then((r) => r.rows).catch(() => query<Row>(select(false), params).then((r) => r.rows));
  const hasNext = rows.length > limit;
  const list = rows.slice(0, limit);

  const [users, actions, entities] = await Promise.all([
    query<{ id: string; email: string }>("select id, email from users order by email").then((r) => r.rows),
    query<{ action: string }>("select distinct action from audit_log order by action").then((r) => r.rows),
    query<{ entity_type: string }>("select distinct entity_type from audit_log where entity_type is not null order by entity_type").then((r) => r.rows),
  ]);
  const link = (n: number) => `/admin/auditoria?${new URLSearchParams(Object.entries({ ...filters, p: String(n) }).filter(([, v]) => v)).toString()}`;

  return (
    <>
      <div className="adm-header"><h1>Auditoria</h1></div>
      <section className="adm-card">
        <form className="adm-filters" action="/admin/auditoria">
          <label>Usuário
            <select name="user" defaultValue={filters.user}>
              <option value="">Todos</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
            </select>
          </label>
          <label>Área
            <select name="entity" defaultValue={filters.entity}>
              <option value="">Todas</option>
              {entities.map((row) => <option key={row.entity_type} value={row.entity_type}>{ENTITIES[row.entity_type] ?? row.entity_type}</option>)}
            </select>
          </label>
          <label>Ação
            <select name="action" defaultValue={filters.action}>
              <option value="">Todas</option>
              {actions.map((row) => <option key={row.action} value={row.action}>{ACTIONS[row.action] ?? row.action}</option>)}
            </select>
          </label>
          <label>Período
            <select name="period" defaultValue={filters.period}>
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="all">Tudo</option>
            </select>
          </label>
          <button className="ad-btn ghost">Filtrar</button>
        </form>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Item</th><th>Detalhes</th><th>IP</th></tr></thead>
            <tbody>
              {list.map((row) => {
                const lines = describe(row.metadata);
                return (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString("pt-BR")}</td>
                    <td>{row.email ?? "Sistema"}</td>
                    <td>{ACTIONS[row.action] ?? row.action}</td>
                    <td>
                      {ENTITIES[row.entity_type ?? ""] ?? row.entity_type ?? "—"}
                      {row.entity_type === "vehicle" && row.entity_id && (
                        <><br />{row.vehicle_title
                          ? <Link href={`/admin/veiculos/${row.entity_id}`} className="ad-row-title">{row.vehicle_title}</Link>
                          : <small>{String(row.metadata?.title ?? "excluído")}</small>}</>
                      )}
                    </td>
                    <td>
                      {lines.length > 2 ? (
                        <details><summary>{lines.length} alteração(ões)</summary><ul className="ad-audit-lines">{lines.map((line) => <li key={line}>{line}</li>)}</ul></details>
                      ) : lines.map((line) => <div key={line}><small>{line}</small></div>)}
                    </td>
                    <td><small>{row.ip ?? "—"}</small></td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={6} className="adm-empty-row">Nenhum registro nesse período.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="adm-pagination">
          {page > 1 && <Link href={link(page - 1)} className="adm-page-link">← Anteriores</Link>}
          {hasNext && <Link href={link(page + 1)} className="adm-page-link">Próximos →</Link>}
        </div>
      </section>
    </>
  );
}
