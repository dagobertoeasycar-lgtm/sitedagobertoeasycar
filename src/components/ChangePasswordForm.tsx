"use client";

import { useState, type FormEvent } from "react";

export function ChangePasswordForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("Validando…");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Não foi possível trocar a senha" })) as { error?: string };
      setMessage(body.error ?? "Não foi possível trocar a senha");
      return;
    }
    setMessage("Senha alterada. Redirecionando…");
    window.location.assign("/admin");
  }
  return <form className="lead-form" onSubmit={submit}><h1>Troque a senha inicial</h1><p>Use ao menos 12 caracteres, combinando letras maiúsculas, minúsculas, número e símbolo.</p><label>Senha atual<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>Nova senha<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label><label>Confirme a nova senha<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label><button className="button" disabled={busy}>{busy ? "Salvando…" : "Alterar senha"}</button><p className="form-status" aria-live="polite">{message}</p></form>;
}
