import Link from "next/link";
import { requireArea } from "@/lib/permissions";
import { query } from "@/lib/db";
import { DEFAULT_EMAIL_SETTINGS, getPublicEmailSettings } from "@/lib/email-settings";
import { EmailSettingsForm } from "@/components/EmailSettingsForm";
import { shortTime } from "@/lib/admin-labels";

export const dynamic = "force-dynamic";

type LogRow = { id: string; created_at: Date; kind: string; recipient: string; subject: string; status: string; error: string | null; lead_name: string | null };

const KIND: Record<string, string> = { lead_internal: "Aviso à equipe", lead_customer: "Confirmação ao cliente", test: "Teste" };
const STATUS: Record<string, [string, string]> = { sent: ["Enviado", "published"], failed: ["Falhou", "draft"], skipped: ["Não enviado", "archived"] };

export default async function EmailSettingsPage() {
  await requireArea("configuracoes");
  const initial = await getPublicEmailSettings().catch(() => ({ ...DEFAULT_EMAIL_SETTINGS, password: undefined, hasPassword: false, source: "none" as const }));
  const [log, stats] = await Promise.all([
    query<LogRow>(`select e.id::text, e.created_at, e.kind, e.recipient, e.subject, e.status, e.error, l.name as lead_name
      from email_log e left join leads l on l.id = e.lead_id order by e.created_at desc limit 40`).then((r) => r.rows).catch(() => []),
    query<{ sent: number; failed: number; skipped: number }>(`select
      count(*) filter (where status='sent')::int as sent, count(*) filter (where status='failed')::int as failed,
      count(*) filter (where status='skipped')::int as skipped from email_log where created_at >= now() - interval '30 days'`).then((r) => r.rows[0]).catch(() => undefined),
  ]);

  return (
    <>
      <div className="adm-header">
        <h1>E-mails e notificações</h1>
        <Link href="/admin/configuracoes" className="adm-link">← Configurações</Link>
      </div>
      <p className="adm-header-description">Cada lead do site gera um aviso para a equipe e uma confirmação para o cliente, saindo do endereço “não responda”.</p>

      <div className="ad-mini-cards">
        <div className="ad-mini-card"><span>Enviados (30 dias)</span><strong>{stats?.sent ?? 0}</strong></div>
        <div className="ad-mini-card"><span>Falharam</span><strong>{stats?.failed ?? 0}</strong></div>
        <div className="ad-mini-card"><span>Não enviados (desativado)</span><strong>{stats?.skipped ?? 0}</strong></div>
        <div className="ad-mini-card"><span>Destinatários de leads</span><strong>{initial.leadRecipients.length}</strong></div>
      </div>

      <EmailSettingsForm initial={initial} />

      <section className="adm-card">
        <div className="adm-card-header"><h2>Histórico de envios</h2></div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Para</th><th>Assunto</th><th>Situação</th></tr></thead>
            <tbody>
              {log.map((row) => (
                <tr key={row.id}>
                  <td title={new Date(row.created_at).toLocaleString("pt-BR")}>{shortTime(row.created_at)}</td>
                  <td>{KIND[row.kind] ?? row.kind}{row.lead_name && <><br /><small>{row.lead_name}</small></>}</td>
                  <td style={{ wordBreak: "break-all" }}>{row.recipient}</td>
                  <td>{row.subject}</td>
                  <td>
                    <span className={`adm-badge ${STATUS[row.status]?.[1] ?? ""}`}>{STATUS[row.status]?.[0] ?? row.status}</span>
                    {row.error && <><br /><small>{row.error}</small></>}
                  </td>
                </tr>
              ))}
              {!log.length && <tr><td colSpan={5} className="adm-empty-row">Nenhum e-mail registrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
