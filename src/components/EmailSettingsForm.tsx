"use client";

import { useState, type FormEvent } from "react";
import type { PublicEmailSettings } from "@/lib/email-settings";

type Feedback = { kind: "ok" | "error"; text: string; action: "save" | "test" } | null;

const PRESETS: Record<string, { host: string; port: number; security: "starttls" | "ssl"; hint: string }> = {
  "Google Workspace / Gmail": { host: "smtp.gmail.com", port: 587, security: "starttls", hint: "Use uma senha de app (conta Google → Segurança → Senhas de app)." },
  "Microsoft 365 / Outlook": { host: "smtp.office365.com", port: 587, security: "starttls", hint: "A conta precisa ter SMTP autenticado liberado no Microsoft 365." },
  "UOL Host (e-mail profissional)": { host: "smtps.uhserver.com", port: 465, security: "ssl", hint: "Usuário é o e-mail completo e a senha é a da caixa criada no painel da UOL Host." },
  "Hostinger": { host: "smtp.hostinger.com", port: 465, security: "ssl", hint: "Usuário é o próprio e-mail criado na Hostinger." },
  "Locaweb": { host: "email-ssl.com.br", port: 465, security: "ssl", hint: "Usuário é o próprio e-mail criado na Locaweb." },
  "Zoho Mail": { host: "smtp.zoho.com", port: 465, security: "ssl", hint: "Use uma senha de aplicativo do Zoho." },
  "Resend (SMTP)": { host: "smtp.resend.com", port: 465, security: "ssl", hint: "Usuário: resend · Senha: sua API key. O domínio precisa estar verificado no Resend." },
  "Brevo (SMTP)": { host: "smtp-relay.brevo.com", port: 587, security: "starttls", hint: "Use o login e a chave SMTP do painel da Brevo." },
};

export function EmailSettingsForm({ initial }: { initial: PublicEmailSettings }) {
  const [form, setForm] = useState({
    enabled: initial.enabled,
    host: initial.host,
    port: String(initial.port),
    security: initial.security,
    user: initial.user,
    password: "",
    fromName: initial.fromName,
    fromEmail: initial.fromEmail,
    replyTo: initial.replyTo,
    leadRecipients: initial.leadRecipients.join(", "),
    notifyCustomer: initial.notifyCustomer,
    whatsapp: initial.whatsapp,
  });
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [source, setSource] = useState(initial.source);
  const [testTo, setTestTo] = useState(initial.leadRecipients[0] ?? "");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function call(action: "save" | "test") {
    setBusy(action);
    setFeedback(null);
    const response = await fetch("/api/admin/email-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, port: Number(form.port), action, testTo }),
    });
    setBusy("");
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const body = await response.json().catch(() => ({})) as PublicEmailSettings & { error?: string };
    if (!response.ok) { setFeedback({ kind: "error", text: body.error || "Não foi possível concluir.", action }); return; }
    if (action === "test") { setFeedback({ kind: "ok", text: `E-mail de teste enviado para ${testTo}. Confira a caixa de entrada (e o spam).`, action }); return; }
    setHasPassword(body.hasPassword);
    setSource(body.source);
    set("password", "");
    setFeedback({ kind: "ok", text: body.enabled ? "Configuração salva. Novos leads já disparam os e-mails." : "Configuração salva. O envio está desativado.", action });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void call("save");
  }

  return (
    <form onSubmit={submit}>
      <section className="adm-card">
        <div className="adm-card-header">
          <h2>Envio de e-mails</h2>
          <span className={`adm-badge ${form.enabled && source !== "none" ? "published" : "draft"}`}>
            {source === "env" ? "Usando variáveis do servidor" : form.enabled ? "Ativo" : "Desativado"}
          </span>
        </div>
        <label className="ad-check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.currentTarget.checked)} />
          <span><b>Enviar e-mails automáticos</b><small>Aviso para a equipe a cada lead novo e confirmação para o cliente.</small></span>
        </label>

        <h3 className="adm-section-title">Servidor SMTP</h3>
        <div className="ad-form-grid">
          <label className="ad-field span-3">
            <span>Provedor (preenche os campos)</span>
            <select defaultValue="" onChange={(e) => {
              const preset = PRESETS[e.currentTarget.value];
              if (!preset) return;
              setForm((current) => ({ ...current, host: preset.host, port: String(preset.port), security: preset.security }));
              setHint(preset.hint);
            }}>
              <option value="">Escolher provedor…</option>
              {Object.keys(PRESETS).map((name) => <option key={name}>{name}</option>)}
            </select>
            {hint && <small>{hint}</small>}
          </label>
          <label className="ad-field"><span>Servidor (host)</span><input value={form.host} onChange={(e) => set("host", e.currentTarget.value)} placeholder="smtp.seudominio.com.br" /></label>
          <label className="ad-field"><span>Porta</span><input value={form.port} onChange={(e) => set("port", e.currentTarget.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
          <label className="ad-field"><span>Segurança</span>
            <select value={form.security} onChange={(e) => set("security", e.currentTarget.value as "starttls" | "ssl")}>
              <option value="starttls">STARTTLS (porta 587)</option>
              <option value="ssl">SSL/TLS (porta 465)</option>
            </select>
          </label>
          <label className="ad-field"><span>Usuário</span><input value={form.user} onChange={(e) => set("user", e.currentTarget.value)} autoComplete="off" /></label>
          <label className="ad-field span-2"><span>Senha</span>
            <input type="password" value={form.password} onChange={(e) => set("password", e.currentTarget.value)} autoComplete="new-password" placeholder={hasPassword ? "•••••••• (salva — deixe em branco para manter)" : "Senha ou chave SMTP"} />
            <small>Guardada cifrada no banco. Nunca é exibida de volta.</small>
          </label>
        </div>

        <h3 className="adm-section-title">Remetente</h3>
        <div className="ad-form-grid">
          <label className="ad-field"><span>Nome do remetente</span><input value={form.fromName} onChange={(e) => set("fromName", e.currentTarget.value)} maxLength={80} /></label>
          <label className="ad-field"><span>E-mail de envio (não responda)</span><input type="email" value={form.fromEmail} onChange={(e) => set("fromEmail", e.currentTarget.value)} placeholder="naoresponda@appautodrive.com.br" /><small>Precisa ser do mesmo domínio autenticado no SMTP.</small></label>
          <label className="ad-field"><span>E-mail de atendimento (opcional)</span><input type="email" value={form.replyTo} onChange={(e) => set("replyTo", e.currentTarget.value)} placeholder="contato@appautodrive.com.br" /><small>Aparece no rodapé para o cliente falar com a equipe.</small></label>
          <label className="ad-field"><span>WhatsApp no rodapé</span><input value={form.whatsapp} onChange={(e) => set("whatsapp", e.currentTarget.value)} maxLength={40} /></label>
        </div>

        <h3 className="adm-section-title">Quem recebe</h3>
        <div className="ad-form-grid">
          <label className="ad-field span-3"><span>E-mails que recebem os leads</span>
            <textarea rows={2} value={form.leadRecipients} onChange={(e) => set("leadRecipients", e.currentTarget.value)} placeholder="vendas@appautodrive.com.br, gerente@appautodrive.com.br" />
            <small>Separe por vírgula (até 10). Responder o aviso escreve direto para o cliente.</small>
          </label>
          <label className="ad-check span-3">
            <input type="checkbox" checked={form.notifyCustomer} onChange={(e) => set("notifyCustomer", e.currentTarget.checked)} />
            <span><b>Enviar confirmação ao cliente</b><small>“Recebemos sua solicitação” com protocolo, resumo e o carro de interesse, saindo do endereço não responda.</small></span>
          </label>
        </div>

        <div className="ad-editor-actions">
          <button className="ad-btn" disabled={Boolean(busy)}>{busy === "save" ? "Salvando…" : "Salvar configuração"}</button>
        </div>
        {feedback?.action === "save" && <p className={`adm-feedback${feedback.kind === "error" ? " error" : ""}`} aria-live="polite">{feedback.text}</p>}
      </section>

      <section className="adm-card">
        <div className="adm-card-header"><h2>Testar envio</h2></div>
        <p className="ad-note">Envia um e-mail de teste com os dados preenchidos acima, mesmo antes de salvar.</p>
        <div className="ad-form-grid">
          <label className="ad-field span-2"><span>Enviar teste para</span><input type="email" value={testTo} onChange={(e) => setTestTo(e.currentTarget.value)} /></label>
          <div className="ad-editor-actions" style={{ border: 0, marginTop: 0, alignSelf: "end" }}>
            <button type="button" className="ad-btn ghost" disabled={Boolean(busy)} onClick={() => void call("test")}>{busy === "test" ? "Enviando…" : "Enviar e-mail de teste"}</button>
          </div>
        </div>
        {feedback?.action === "test" && <p className={`adm-feedback${feedback.kind === "error" ? " error" : ""}`} aria-live="polite">{feedback.text}</p>}
      </section>
    </form>
  );
}
