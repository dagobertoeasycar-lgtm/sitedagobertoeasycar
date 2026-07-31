"use client";

import { useState, type FormEvent } from "react";

export function VehicleStatusForm({ id, status }: { id: string; status: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: data.get("status") }),
    });
    setBusy(false);
    if (!response.ok) { setMessage("Falhou"); return; }
    setMessage("Salvo");
    window.location.reload();
  }
  return <form className="status-form" onSubmit={submit}><select name="status" defaultValue={status} aria-label="Status do veículo"><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="paused">Pausado</option><option value="sold">Vendido</option></select><button className="button button-small" disabled={busy}>{busy ? "Salvando…" : "Aplicar"}</button><small aria-live="polite">{message}</small></form>;
}
