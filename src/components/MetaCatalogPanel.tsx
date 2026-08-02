"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MetaFeedIssue, MetaFeedSettings } from "@/lib/meta-feed";

type MetaFeedAdminData = {
  feedUrl: string;
  generatedAt: string;
  lastModified: string | null;
  exported: number;
  ignored: number;
  errors: number;
  issues: MetaFeedIssue[];
  settings: MetaFeedSettings;
  lastValidation: { generated_at: string; exported: number; ignored: number; errors: number } | null;
};

const availabilityOptions = [
  ["in stock", "Em estoque"],
  ["out of stock", "Fora de estoque"],
  ["available for order", "Disponível para encomenda"],
  ["discontinued", "Descontinuado"],
  ["exclude", "Não exportar"],
] as const;

function dateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Ainda não registrado";
}

export function MetaCatalogPanel() {
  const [data, setData] = useState<MetaFeedAdminData | null>(null);
  const [settings, setSettings] = useState<MetaFeedSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/meta-feed", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar a integração");
    const payload = await response.json() as MetaFeedAdminData;
    setData(payload);
    setSettings(payload.settings);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/meta-feed", { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error("Não foi possível carregar a integração");
        return response.json() as Promise<MetaFeedAdminData>;
      })
      .then(payload => {
        if (!active) return;
        setData(payload);
        setSettings(payload.settings);
      })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Erro ao carregar"); });
    return () => { active = false; };
  }, []);

  const invalidIssues = useMemo(
    () => (data?.issues ?? []).filter(item => !["not_published", "availability_excluded"].includes(item.code)),
    [data],
  );

  async function save() {
    if (!settings) return;
    setBusy(true);
    setMessage("Salvando configurações…");
    const response = await fetch("/api/admin/meta-feed", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setBusy(false);
    if (!response.ok) { setMessage("Não foi possível salvar as configurações."); return; }
    const payload = await response.json() as MetaFeedAdminData;
    setData(payload);
    setSettings(payload.settings);
    setMessage("Configurações salvas. O feed já usa os novos valores.");
  }

  async function validate() {
    setBusy(true);
    setMessage("Validando estrutura, campos e URLs do feed…");
    const response = await fetch("/api/admin/meta-feed", { method: "POST" });
    const payload = await response.json() as { errors?: number };
    setBusy(false);
    if (!response.ok) { setMessage("A validação falhou."); return; }
    await load();
    setMessage(payload.errors ? `Validação concluída com ${payload.errors} item(ns) inválido(s).` : "Feed validado sem erros estruturais.");
  }

  async function copyUrl() {
    if (!data) return;
    await navigator.clipboard.writeText(data.feedUrl);
    setMessage("URL copiada.");
  }

  if (!data || !settings) return <div className="adm-card meta-loading">Carregando integração com a Meta…</div>;

  return (
    <div className="meta-catalog-panel">
      <div className="adm-card meta-feed-summary">
        <div>
          <p className="meta-kicker">Fonte automática de dados</p>
          <h2>Feed do Catálogo Meta</h2>
          <a href={data.feedUrl} target="_blank" rel="noreferrer" className="meta-feed-url">{data.feedUrl}</a>
        </div>
        <div className="meta-actions">
          <button className="button button-outline" type="button" onClick={copyUrl}>Copiar URL</button>
          <button className="button" type="button" onClick={validate} disabled={busy}>Validar feed</button>
        </div>
      </div>

      <div className="adm-stats meta-feed-stats">
        <div className="adm-stat"><div><strong>{data.exported}</strong><span>Exportados</span></div></div>
        <div className="adm-stat"><div><strong>{data.ignored}</strong><span>Ignorados</span></div></div>
        <div className="adm-stat"><div><strong>{data.errors}</strong><span>Erros</span></div></div>
        <div className="adm-stat"><div><strong>{dateTime(data.lastModified)}</strong><span>Última alteração</span></div></div>
      </div>

      <div className="adm-grid-2 meta-grid">
        <section className="adm-card meta-section">
          <div className="adm-card-header"><h2>Disponibilidade e imagens</h2></div>
          <div className="meta-form-grid">
            <label>Veículo publicado
              <select value={settings.availabilityPublished} onChange={event => setSettings({ ...settings, availabilityPublished: event.target.value as MetaFeedSettings["availabilityPublished"] })}>
                {availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Veículo reservado
              <select value={settings.availabilityReserved} onChange={event => setSettings({ ...settings, availabilityReserved: event.target.value as MetaFeedSettings["availabilityReserved"] })}>
                {availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Veículo vendido
              <select value={settings.availabilitySold} onChange={event => setSettings({ ...settings, availabilitySold: event.target.value as MetaFeedSettings["availabilitySold"] })}>
                {availabilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="meta-span-2">Imagem padrão HTTPS
              <input value={settings.defaultImageUrl} onChange={event => setSettings({ ...settings, defaultImageUrl: event.target.value })} />
            </label>
            <label className="meta-check meta-span-2">
              <input type="checkbox" checked={settings.includeWithoutImages} onChange={event => setSettings({ ...settings, includeWithoutImages: event.target.checked })} />
              Incluir veículos sem fotos usando a imagem padrão
            </label>
          </div>
        </section>

        <section className="adm-card meta-section">
          <div className="adm-card-header"><h2>Vinculação obrigatória</h2></div>
          <div className="meta-form-grid">
            <label>ID do catálogo<input value={settings.catalogId} onChange={event => setSettings({ ...settings, catalogId: event.target.value })} placeholder="A confirmar no Commerce Manager" /></label>
            <label>Portfólio empresarial<input value={settings.businessPortfolio} onChange={event => setSettings({ ...settings, businessPortfolio: event.target.value })} /></label>
            <label>Conta do WhatsApp Business<input value={settings.whatsappAccount} onChange={event => setSettings({ ...settings, whatsappAccount: event.target.value })} /></label>
            <label>Página do Facebook<input value={settings.facebookPage} onChange={event => setSettings({ ...settings, facebookPage: event.target.value })} /></label>
            <label>Número oficial<input value={settings.phoneNumber} onChange={event => setSettings({ ...settings, phoneNumber: event.target.value })} /></label>
            <label>ID da fonte de dados<input value={settings.dataSourceId} onChange={event => setSettings({ ...settings, dataSourceId: event.target.value })} /></label>
          </div>
          <p className="meta-flow">Estoque do site → feed automático → catálogo “Dagoberto easycar” → WhatsApp Business → +55 11 93471-8276</p>
        </section>
      </div>

      <div className="meta-save-row">
        <button className="button" type="button" onClick={save} disabled={busy}>Salvar configurações</button>
        <span aria-live="polite">{message}</span>
      </div>

      <section className="adm-card meta-section">
        <div className="adm-card-header">
          <h2>Relatório de itens inválidos ({invalidIssues.length})</h2>
          <div className="meta-times">
            <span>Geração atual: {dateTime(data.generatedAt)}</span>
            <span>Última validação: {dateTime(data.lastValidation?.generated_at)}</span>
          </div>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>ID estável</th><th>Veículo</th><th>Código</th><th>Motivo</th></tr></thead>
            <tbody>
              {invalidIssues.map(item => <tr key={`${item.id}-${item.code}`}><td><code>{item.id}</code></td><td>{item.title}</td><td>{item.code}</td><td>{item.message}</td></tr>)}
              {!invalidIssues.length && <tr><td colSpan={4} className="meta-empty">Nenhum item inválido.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
