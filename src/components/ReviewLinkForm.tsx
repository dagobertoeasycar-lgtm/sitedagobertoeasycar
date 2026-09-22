"use client";

import { useState, type FormEvent } from "react";

/**
 * Link de avaliação do Google usado nos pedidos de avaliação por WhatsApp.
 * O link sai do Perfil da Empresa, em "Pedir avaliações".
 */
export function ReviewLinkForm({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/review-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    setBusy(false);
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setMessage({ kind: "error", text: body.error || "Não foi possível salvar." }); return; }
    setMessage({ kind: "ok", text: url ? "Link salvo. O botão de pedir avaliação já aparece nos leads." : "Link removido." });
  }

  return (
    <section className="adm-card">
      <div className="adm-card-header"><h2>Pedido de avaliação no Google</h2></div>
      <form className="ad-form-grid" onSubmit={save}>
        <label className="ad-field span-2">
          <span>Link de avaliação</span>
          <input value={url} onChange={(event) => setUrl(event.currentTarget.value)} placeholder="https://g.page/r/..." />
          <small>Pegue em business.google.com → Pedir avaliações. Com o link salvo, cada lead ganha o botão “Pedir avaliação”, que abre o WhatsApp com a mensagem pronta.</small>
        </label>
        <div className="ad-editor-actions" style={{ border: 0, marginTop: 0, alignSelf: "end" }}>
          <button className="ad-btn" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
      {message && <p className={`adm-feedback${message.kind === "error" ? " error" : ""}`} aria-live="polite">{message.text}</p>}
    </section>
  );
}
