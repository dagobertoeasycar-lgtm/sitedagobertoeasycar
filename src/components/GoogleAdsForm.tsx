"use client";

import { useState, type FormEvent } from "react";
import type { AdsConversions } from "@/lib/ads-conversions";

/**
 * Rótulos de conversão do Google Ads. Cada ação de conversão criada no Google
 * Ads tem um rótulo no formato AW-123456789/AbCdEfG, que aparece em
 * "Configurar a tag" → "Usar o Gerenciador de tags" ou no trecho de código.
 */
export function GoogleAdsForm({ initial }: { initial: AdsConversions }) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/google-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setBusy(false);
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setMessage({ kind: "error", text: body.error || "Não foi possível salvar." }); return; }
    setMessage({ kind: "ok", text: "Conversões salvas. O site passa a avisar o Google Ads a cada lead e clique no WhatsApp." });
  }

  return (
    <section className="adm-card">
      <div className="adm-card-header"><h2>Conversões do Google Ads</h2></div>
      <form className="ad-form-grid" onSubmit={save}>
        <label className="ad-field">
          <span>Lead enviado (formulários)</span>
          <input value={values.lead} onChange={(event) => setValues({ ...values, lead: event.currentTarget.value })} placeholder="AW-18468438331/AbCdEfG" />
        </label>
        <label className="ad-field">
          <span>Clique em WhatsApp ou telefone</span>
          <input value={values.whatsapp} onChange={(event) => setValues({ ...values, whatsapp: event.currentTarget.value })} placeholder="AW-18468438331/HiJkLmN" />
        </label>
        <div className="ad-editor-actions" style={{ border: 0, marginTop: 0, alignSelf: "end" }}>
          <button className="ad-btn" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
        <p className="ad-note span-3">
          Deixe em branco para não medir aquela conversão. A tag do Google já está instalada em todas as páginas; estes rótulos só dizem
          qual ação contar.
        </p>
      </form>
      {message && <p className={`adm-feedback${message.kind === "error" ? " error" : ""}`} aria-live="polite">{message.text}</p>}
    </section>
  );
}
