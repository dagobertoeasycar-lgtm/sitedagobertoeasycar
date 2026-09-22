"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Copy, Eye, Lock, Save, Send } from "lucide-react";
import { VEHICLE_FIELDS, type VehicleEditorData } from "@/lib/admin-vehicle";
import { VehiclePhotosPanel } from "@/components/VehiclePhotosPanel";

export type HistoryItem = { when: string; who: string; what: string; detail?: string };

type Values = VehicleEditorData["values"] & { status: string; stockStatus: string };

const TABS = [
  "Dados principais",
  "Preço e condições",
  "Ficha técnica",
  "Opcionais",
  "Mídia",
  "SEO",
  "Integração",
  "Histórico",
  "Publicação",
] as const;
type Tab = (typeof TABS)[number];

const ORIGINS: Record<string, string> = { OWN: "Estoque próprio", PARTNER: "Lojista parceiro", PRIVATE: "Particular intermediado" };
const FIELD_BY_KEY = Object.fromEntries(VEHICLE_FIELDS.map((field) => [field.key, field]));

function timeNow() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseDraft(raw: string) {
  try {
    return JSON.parse(raw) as { values: Record<string, unknown>; at: string };
  } catch {
    return null;
  }
}

export function VehicleEditor({
  vehicle,
  history,
  pasta,
  fotos,
}: {
  vehicle: VehicleEditorData;
  history: HistoryItem[];
  pasta: string;
  fotos: number;
}) {
  const initial = useMemo<Values>(
    () => ({ ...vehicle.values, status: vehicle.status, stockStatus: vehicle.stockStatus }),
    [vehicle],
  );
  const draftKey = `ad-draft-${vehicle.id}`;
  const synced = Boolean(vehicle.sourceId);
  const [tab, setTab] = useState<Tab>("Dados principais");
  const [values, setValues] = useState<Values>(initial);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [restored, setRestored] = useState(false);
  // O snapshot do localStorage não muda quando a própria aba grava ou apaga,
  // então guardamos aqui que o rascunho antigo já foi tratado.
  const [draftHandled, setDraftHandled] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Rascunho local deixado por uma sessão anterior (queda de conexão, aba
  // fechada). Só é aplicado quando a pessoa pede, para não sobrescrever a
  // versão do banco sem ela ver.
  const storedDraft = useSyncExternalStore(
    subscribeStorage,
    () => readStorage(draftKey),
    () => null,
  );
  const pendingDraft = !draftHandled && !dirty && storedDraft ? parseDraft(storedDraft) : null;

  function restoreDraft() {
    if (!pendingDraft) return;
    setValues({ ...initial, ...pendingDraft.values } as Values);
    setSavedAt(pendingDraft.at);
    setDirty(true);
    setRestored(true);
    setDraftHandled(true);
  }

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      const at = timeNow();
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ values, at }));
        setSavedAt(at);
      } catch {
        // ignora
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirty, draftKey, values]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = useCallback((key: string, value: string | number | boolean | string[] | null) => {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setDraftHandled(true);
  }, []);

  const locked = (key: string) => synced && Boolean(FIELD_BY_KEY[key]?.syncOwned);

  function discardDraft() {
    try { window.localStorage.removeItem(draftKey); } catch { /* ignora */ }
    setDraftHandled(true);
    setValues(initial);
    setDirty(false);
    setRestored(false);
    setSavedAt("");
  }

  async function save(overrides: Partial<Values> = {}) {
    setBusy("salvando");
    setMessage(null);
    const payload: Record<string, unknown> = { ...values, ...overrides };
    // Não manda o que a sincronização controla: a API ignoraria de qualquer forma.
    if (synced) for (const field of VEHICLE_FIELDS) if (field.syncOwned) delete payload[field.key];
    const response = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy("");
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const body = await response.json().catch(() => ({})) as { error?: string; changed?: Record<string, unknown> };
    if (!response.ok) { setMessage({ kind: "error", text: body.error || "Não foi possível salvar." }); return; }
    try { window.localStorage.removeItem(draftKey); } catch { /* ignora */ }
    setValues((current) => ({ ...current, ...overrides }) as Values);
    setDirty(false);
    setRestored(false);
    const count = Object.keys(body.changed ?? {}).length;
    setMessage({ kind: "ok", text: count ? `Salvo: ${count} campo(s) alterado(s).` : "Nada mudou desde o último salvamento." });
  }

  async function duplicate() {
    if (!window.confirm("Criar uma cópia deste anúncio como rascunho?")) return;
    setBusy("duplicando");
    const response = await fetch(`/api/admin/vehicles/${vehicle.id}/duplicate`, { method: "POST" });
    setBusy("");
    const body = await response.json().catch(() => ({})) as { id?: string; error?: string };
    if (!response.ok || !body.id) { setMessage({ kind: "error", text: body.error || "Não foi possível duplicar." }); return; }
    window.location.assign(`/admin/veiculos/${body.id}`);
  }

  const text = (key: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={`ad-field${locked(key) ? " locked" : ""}`}>
      <span>{label}{locked(key) && <Lock size={12} aria-label="controlado pela sincronização" />}</span>
      <input
        value={values[key] === null || values[key] === undefined ? "" : String(values[key])}
        onChange={(event) => set(key, event.currentTarget.value)}
        disabled={locked(key)}
        {...props}
      />
    </label>
  );

  const area = (key: string, label: string, rows = 5, help?: string) => (
    <label className={`ad-field wide${locked(key) ? " locked" : ""}`}>
      <span>{label}{locked(key) && <Lock size={12} aria-label="controlado pela sincronização" />}</span>
      <textarea
        rows={rows}
        value={Array.isArray(values[key]) ? (values[key] as string[]).join("\n") : String(values[key] ?? "")}
        onChange={(event) => set(key, FIELD_BY_KEY[key]?.type === "list" ? event.currentTarget.value.split("\n") : event.currentTarget.value)}
        disabled={locked(key)}
      />
      {help && <small>{help}</small>}
    </label>
  );

  const check = (key: string, label: string, help?: string) => (
    <label className={`ad-check${locked(key) ? " locked" : ""}`}>
      <input type="checkbox" checked={Boolean(values[key])} onChange={(event) => set(key, event.currentTarget.checked)} disabled={locked(key)} />
      <span><strong>{label}</strong>{help && <small>{help}</small>}</span>
    </label>
  );

  const seoTitle = String(values.seoTitle ?? "");
  const seoDescription = String(values.seoDescription ?? "");

  return (
    <section className="adm-card ad-editor">
      <div className="adm-card-header"><h2>Cadastro / edição de anúncio</h2></div>

      <div className="ad-tabs" role="tablist">
        {TABS.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </div>

      {pendingDraft && (
        <div className="ad-draft-banner">
          Há alterações não salvas deste anúncio feitas neste navegador às {pendingDraft.at}.
          <button type="button" onClick={restoreDraft}>Recuperar</button>
          <button type="button" onClick={discardDraft}>Descartar</button>
        </div>
      )}
      {dirty && (
        <div className="ad-draft-banner">
          {restored ? "Alterações não salvas recuperadas deste navegador" : "Rascunho salvo automaticamente"}
          {savedAt && ` às ${savedAt}`}. Salve antes de sair para não perder.
          <button type="button" onClick={discardDraft}>Descartar</button>
        </div>
      )}
      {synced && (
        <p className="ad-note">
          <Lock size={13} aria-hidden /> Anúncio importado de {vehicle.partnerName || "parceiro"}. Os campos com cadeado
          vêm da fonte e são atualizados a cada sincronização. Destaque, SEO, observações, placa, vídeo e publicação podem ser editados.
        </p>
      )}

      <div className="ad-tab-panel">
        {tab === "Dados principais" && (
          <div className="ad-form-grid">
            <div className="span-2">{text("title", "Título do anúncio")}</div>
            <label className="ad-field">
              <span>Status</span>
              <select value={values.status} onChange={(event) => set("status", event.currentTarget.value)}>
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="paused">Pausado</option>
                <option value="sold">Vendido</option>
              </select>
            </label>
            {text("brand", "Marca")}
            {text("model", "Modelo")}
            {text("version", "Versão")}
            {text("yearMake", "Ano fabricação", { type: "number", min: 1950, max: 2100 })}
            {text("yearModel", "Ano modelo", { type: "number", min: 1950, max: 2100 })}
            {text("color", "Cor")}
            {text("fuel", "Combustível")}
            {text("transmission", "Câmbio")}
            {text("bodyType", "Carroceria")}
            {text("doors", "Portas", { type: "number", min: 0, max: 9 })}
            {text("mileage", "Quilometragem", { type: "number", min: 0 })}
            {text("plate", "Placa")}
            <label className="ad-field">
              <span>Fonte</span>
              <input value={synced ? `${vehicle.partnerName || "Parceiro"} (sincronizado)` : ORIGINS[vehicle.originType] ?? vehicle.originType} disabled />
            </label>
            <div className="span-3">{area("internalNotes", "Observações internas", 3, "Não aparece no site.")}</div>
          </div>
        )}

        {tab === "Preço e condições" && (
          <div className="ad-form-grid">
            {text("price", "Preço publicado (R$)", { type: "number", min: 0, step: "0.01" })}
            {text("oldPrice", "Preço anterior (R$) — aparece riscado", { type: "number", min: 0, step: "0.01" })}
            {text("city", "Cidade do anúncio")}
            {vehicle.originPriceCents !== null && (
              <div className="span-3 ad-note">
                Preço na origem: <strong>{(vehicle.originPriceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
                {" · "}acréscimo aplicado: <strong>{((vehicle.markupCents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>.
                {" "}A regra de acréscimo fica em Configurações → Regra de preço.
              </div>
            )}
            <div className="span-3">{check("promotion", "Anúncio em promoção", "Mostra o selo de promoção e o preço anterior riscado.")}</div>
          </div>
        )}

        {tab === "Ficha técnica" && (
          <div className="ad-form-grid">
            {text("fuel", "Combustível")}
            {text("transmission", "Câmbio")}
            {text("bodyType", "Carroceria")}
            {text("doors", "Portas", { type: "number", min: 0, max: 9 })}
            {text("color", "Cor")}
            {text("mileage", "Quilometragem", { type: "number", min: 0 })}
            <div className="span-3">{area("description", "Descrição do anúncio", 8)}</div>
          </div>
        )}

        {tab === "Opcionais" && (
          <div className="ad-form-grid">
            <div className="span-3">{area("options", "Opcionais (um por linha)", 12, "Ex.: Ar-condicionado, Direção elétrica, Central multimídia.")}</div>
          </div>
        )}

        {tab === "Mídia" && (
          <div className="ad-form-grid">
            <div className="span-3 ad-media-summary">
              {vehicle.imageUrl ? <img src={vehicle.imageUrl} alt="" /> : <div className="ad-media-empty">Sem foto principal</div>}
              <div>
                <strong>{fotos} foto(s) na galeria</strong>
                <small>{vehicle.photosLocked ? "Fotos travadas: a sincronização não mexe nelas." : "Fotos acompanham a origem."}</small>
              </div>
            </div>
            <div className="span-3"><VehiclePhotosPanel id={vehicle.id} titulo={String(values.title ?? "")} pasta={pasta} fotos={fotos} /></div>
            <div className="span-3">{text("videoUrl", "Vídeo (link do YouTube ou arquivo)")}</div>
          </div>
        )}

        {tab === "SEO" && (
          <div className="ad-form-grid">
            <div className="span-3">{text("seoTitle", `Título para o Google (${seoTitle.length}/70)`, { maxLength: 70, placeholder: String(values.title ?? "") })}</div>
            <div className="span-3">{area("seoDescription", `Descrição para o Google (${seoDescription.length}/170)`, 3, "Deixe em branco para usar a descrição automática.")}</div>
            <div className="span-3 ad-serp">
              <small>https://www.appautodrive.com.br/veiculos/{vehicle.slug}</small>
              <strong>{seoTitle || String(values.title ?? "")} | Autodrive Veículos</strong>
              <p>{seoDescription || String(values.description ?? "").slice(0, 160) || "Descrição automática do anúncio."}</p>
            </div>
          </div>
        )}

        {tab === "Integração" && (
          <dl className="ad-facts">
            <dt>Origem</dt><dd>{ORIGINS[vehicle.originType] ?? vehicle.originType}</dd>
            <dt>Parceiro</dt><dd>{vehicle.partnerName || "—"}</dd>
            <dt>Fonte da sincronização</dt><dd>{vehicle.sourceId || "Cadastro manual (não sincroniza)"}</dd>
            <dt>ID na fonte</dt><dd>{vehicle.externalId || "—"}</dd>
            <dt>Anúncio original</dt><dd>{vehicle.sourceUrl ? <a href={vehicle.sourceUrl} target="_blank" rel="noreferrer">{vehicle.sourceUrl}</a> : "—"}</dd>
            <dt>Visto na fonte pela última vez</dt><dd>{vehicle.lastSeenAt ? new Date(vehicle.lastSeenAt).toLocaleString("pt-BR") : "—"}</dd>
            <dt>Cadastrado em</dt><dd>{new Date(vehicle.createdAt).toLocaleString("pt-BR")}</dd>
            <dt>Última alteração</dt><dd>{new Date(vehicle.updatedAt).toLocaleString("pt-BR")}</dd>
          </dl>
        )}

        {tab === "Histórico" && (
          <ol className="ad-timeline">
            {history.map((item, index) => (
              <li key={index}>
                <time>{new Date(item.when).toLocaleString("pt-BR")}</time>
                <strong>{item.what}</strong>
                <span>{item.who}</span>
                {item.detail && <small>{item.detail}</small>}
              </li>
            ))}
            {!history.length && <li><span>Nenhum registro ainda.</span></li>}
          </ol>
        )}

        {tab === "Publicação" && (
          <div className="ad-form-grid">
            <label className="ad-field">
              <span>Publicação</span>
              <select value={values.status} onChange={(event) => set("status", event.currentTarget.value)}>
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="paused">Pausado</option>
                <option value="sold">Vendido</option>
              </select>
            </label>
            <label className="ad-field">
              <span>Disponibilidade</span>
              <select value={values.stockStatus} onChange={(event) => set("stockStatus", event.currentTarget.value)}>
                <option value="available">Disponível</option>
                <option value="reserved">Reservado</option>
                <option value="sold">Vendido</option>
              </select>
            </label>
            <div />
            <div className="span-3">{check("featured", "Veículo em destaque", "Aparece primeiro na vitrine e conta no card de destaques.")}</div>
          </div>
        )}
      </div>

      {message && <p className={`adm-feedback${message.kind === "error" ? " error" : ""}`} aria-live="polite">{message.text}</p>}

      <div className="ad-editor-actions">
        <button type="button" className="ad-btn ghost" onClick={() => save()} disabled={Boolean(busy)}><Save size={15} aria-hidden />{busy === "salvando" ? "Salvando…" : "Salvar alterações"}</button>
        <a className="ad-btn ghost" href={`/veiculos/${vehicle.slug}`} target="_blank" rel="noreferrer"><Eye size={15} aria-hidden />Pré-visualizar</a>
        <button type="button" className="ad-btn ghost" onClick={duplicate} disabled={Boolean(busy)}><Copy size={15} aria-hidden />Duplicar anúncio</button>
        <button type="button" className="ad-btn" onClick={() => save({ status: "published" })} disabled={Boolean(busy)}><Send size={15} aria-hidden />Publicar</button>
      </div>
    </section>
  );
}
