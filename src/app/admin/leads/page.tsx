import Link from "next/link";
import { Columns3, List } from "lucide-react";
import { requireArea } from "@/lib/permissions";
import { LeadsView } from "@/components/LeadsView";
import { CrmBoard } from "@/components/CrmBoard";
import { listTags, listUsers, loadBoard } from "@/lib/crm";
import { LEAD_KIND_LABELS } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireArea("leads");
  const sp = await searchParams;
  const view = sp.ver === "lista" ? "lista" : "quadro";

  const header = (
    <div className="adm-header">
      <h1>Leads · CRM</h1>
      <div className="ad-tabs" style={{ marginBottom: 0 }}>
        <Link href="/admin/leads" className={`ad-tab-link${view === "quadro" ? " active" : ""}`}><Columns3 size={15} aria-hidden /> Quadro</Link>
        <Link href="/admin/leads?ver=lista" className={`ad-tab-link${view === "lista" ? " active" : ""}`}><List size={15} aria-hidden /> Lista</Link>
      </div>
    </div>
  );

  if (view === "lista") {
    return (
      <>
        {header}
        <LeadsView mode="contacts" searchParams={sp} basePath="/admin/leads" extraParams={{ ver: "lista" }} />
      </>
    );
  }

  const filters = { q: sp.q?.trim() || "", kind: sp.kind || "", owner: sp.owner || "", tag: sp.tag || "" };
  const [board, users, tags] = await Promise.all([
    loadBoard(filters).then((cards) => ({ cards, error: "" })).catch((error: unknown) => ({ cards: [], error: error instanceof Error ? error.message : String(error) })),
    listUsers(),
    listTags(),
  ]);
  const active = Object.values(filters).some(Boolean);

  return (
    <>
      {header}
      {board.error && <p className="adm-feedback error">O CRM precisa da migração 024 (npm run db:migrate). Detalhe: {board.error}</p>}
      <form className="adm-filters crm-filters" action="/admin/leads">
        <label>Busca<input name="q" defaultValue={filters.q} placeholder="Nome, telefone, e-mail ou carro" /></label>
        <label>Tipo
          <select name="kind" defaultValue={filters.kind}>
            <option value="">Todos</option>
            {Object.entries(LEAD_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Responsável
          <select name="owner" defaultValue={filters.owner}>
            <option value="">Todos</option>
            <option value="none">Sem responsável</option>
            {users.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {tags.length > 0 && (
          <label>Etiqueta
            <select name="tag" defaultValue={filters.tag}>
              <option value="">Todas</option>
              {tags.map((tag) => <option key={tag}>{tag}</option>)}
            </select>
          </label>
        )}
        <button className="ad-btn ghost">Filtrar</button>
        {active && <Link href="/admin/leads" className="adm-link">Limpar</Link>}
        <span className="ad-push-right ad-total">Arraste os cards entre as etapas · clique para abrir</span>
      </form>
      <CrmBoard
        initialCards={JSON.parse(JSON.stringify(board.cards))}
        users={users}
        tags={tags}
        canDelete={user.role === "admin"}
        openId={UUID_RE.test(sp.abrir ?? "") ? sp.abrir : undefined}
      />
    </>
  );
}
