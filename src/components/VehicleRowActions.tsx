"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Eye, Pencil, Trash2 } from "lucide-react";

/** Ações da linha na lista de anúncios: ver, editar, duplicar e excluir. */
export function VehicleRowActions({ id, slug, title, synced }: { id: string; slug: string; title: string; synced: boolean }) {
  const [busy, setBusy] = useState(false);

  async function duplicate() {
    if (!window.confirm(`Criar uma cópia de "${title}" como rascunho?`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/vehicles/${id}/duplicate`, { method: "POST" });
    const body = await response.json().catch(() => ({})) as { id?: string; error?: string };
    setBusy(false);
    if (!response.ok || !body.id) { window.alert(body.error || "Não foi possível duplicar."); return; }
    window.location.assign(`/admin/veiculos/${body.id}`);
  }

  async function remove() {
    const aviso = synced
      ? "\n\nEle veio de parceiro: entra na lista de bloqueio e não volta na próxima sincronização."
      : "";
    if (!window.confirm(`Excluir "${title}" de vez?${aviso}`)) return;
    const motivo = window.prompt("Motivo (opcional):", "") ?? "";
    setBusy(true);
    const response = await fetch(`/api/admin/vehicles/${id}?motivo=${encodeURIComponent(motivo)}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) { window.alert(body.error || "Não foi possível excluir."); return; }
    window.location.reload();
  }

  return (
    <div className="ad-icon-actions">
      <a className="ad-icon-btn" href={`/veiculos/${slug}`} target="_blank" rel="noreferrer" title="Ver no site" aria-label="Ver no site"><Eye size={15} /></a>
      <Link className="ad-icon-btn" href={`/admin/veiculos/${id}`} title="Editar" aria-label="Editar"><Pencil size={15} /></Link>
      <button type="button" className="ad-icon-btn" onClick={duplicate} disabled={busy} title="Duplicar" aria-label="Duplicar"><Copy size={15} /></button>
      <button type="button" className="ad-icon-btn danger" onClick={remove} disabled={busy} title="Excluir" aria-label="Excluir"><Trash2 size={15} /></button>
    </div>
  );
}
