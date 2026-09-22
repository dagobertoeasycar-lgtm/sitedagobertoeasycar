"use client";

import { useState } from "react";
import { LEAD_STATUS_LABELS } from "@/lib/admin-labels";

type Option = { id: string; label: string };

async function patch(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/admin/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 401) { window.location.assign("/admin/login"); return "Sessão expirada"; }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    return data.error || "Não foi possível salvar";
  }
  return "";
}

/** Status e responsável editáveis direto na linha; salvam ao trocar. */
export function LeadQuickFields({ id, status, assignedTo, users }: { id: string; status: string; assignedTo: string | null; users: Option[] }) {
  const [state, setState] = useState({ status, assignedTo: assignedTo ?? "" });
  const [feedback, setFeedback] = useState("");

  async function change(field: "status" | "assignedTo", value: string) {
    const previous = state;
    setState({ ...state, [field]: value });
    setFeedback("…");
    const error = await patch(id, { [field]: value });
    if (error) { setState(previous); setFeedback(error); return; }
    setFeedback("✓");
    window.setTimeout(() => setFeedback(""), 1500);
  }

  return (
    <div className="ad-lead-quick">
      <select value={state.status} onChange={(event) => change("status", event.currentTarget.value)} aria-label="Status do lead" className={`ad-status-select ${state.status}`}>
        {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select value={state.assignedTo} onChange={(event) => change("assignedTo", event.currentTarget.value)} aria-label="Responsável">
        <option value="">Sem responsável</option>
        {users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
      </select>
      {feedback && <small aria-live="polite" title={feedback}>{feedback.length > 2 ? "Erro" : feedback}</small>}
    </div>
  );
}

/** Anotações internas do atendimento, dentro do detalhe do lead. */
export function LeadNotes({ id, notes }: { id: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [saved, setSaved] = useState(notes ?? "");
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("Salvando…");
    const error = await patch(id, { notes: value });
    if (error) { setMessage(error); return; }
    setSaved(value);
    setMessage("Anotação salva.");
  }

  return (
    <div className="ad-lead-notes">
      <label>
        <span>Anotações do atendimento</span>
        <textarea rows={3} value={value} onChange={(event) => setValue(event.currentTarget.value)} placeholder="Ex.: ligou 10h, pediu simulação em 48x…" />
      </label>
      <div>
        <button type="button" className="ad-btn small" onClick={save} disabled={value === saved}>Salvar anotação</button>
        {message && <small aria-live="polite">{message}</small>}
      </div>
    </div>
  );
}
