"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  Archive, ArrowLeft, ArrowRight, CalendarClock, Car, ExternalLink, Mail, MessageCircle, Phone, Plus, Repeat, Search,
  StickyNote, Tag, Trash2, UserRound, X,
} from "lucide-react";
import type { CrmActivity, CrmCard, CrmLeadDetail, CrmVehicle } from "@/lib/crm";
import { brl, CRM_STAGES, crmStageOf, LEAD_KIND_LABELS, LEAD_STATUS_LABELS, LOST_REASONS, SUGGESTED_TAGS } from "@/lib/admin-labels";

type User = { id: string; label: string };
type Toast = { kind: "ok" | "error"; text: string } | null;

const INTENT_LABELS: Record<string, string> = { simulacao: "Simulação", interesse: "Interesse", visita: "Visita" };

function kindLabel(card: Pick<CrmCard, "kind" | "intent" | "financing_service">) {
  if (card.intent && INTENT_LABELS[card.intent]) return INTENT_LABELS[card.intent];
  if (card.kind === "financing" && card.financing_service === "private") return "Financia Fácil";
  return LEAD_KIND_LABELS[card.kind] ?? card.kind;
}

function ago(date: string | null) {
  if (!date) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (60 * 24))} d`;
}

function dateTime(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(date: string | null) {
  if (!date) return "";
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

function initials(label: string | undefined) {
  if (!label) return "";
  const parts = label.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function whatsapp(phone: string, name: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(`Olá, ${name.split(" ")[0]}! Aqui é da Autodrive Veículos.`)}`;
}

const CARD_KEYS = [
  "id", "kind", "name", "phone", "email", "status", "created_at", "updated_at", "stage_changed_at", "scheduled_at", "tags",
  "assigned_to", "lead_source", "utm_source", "payment_method", "has_trade", "intent", "financing_service", "vehicle",
] as const satisfies readonly (keyof CrmCard)[];

function cardFromDetail(detail: CrmLeadDetail): CrmCard {
  return Object.fromEntries(CARD_KEYS.map((key) => [key, detail[key]])) as CrmCard;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (response.status === 401) { window.location.assign("/admin/login"); throw new Error("Sessão expirada"); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || "Não foi possível salvar.");
  return body as T;
}

/* ------------------------------------------------------------------ */
/* Quadro                                                              */
/* ------------------------------------------------------------------ */

export function CrmBoard({ initialCards, users, tags, canDelete, openId }: { initialCards: CrmCard[]; users: User[]; tags: string[]; canDelete: boolean; openId?: string }) {
  const [cards, setCards] = useState(initialCards);
  const [openLead, setOpenLead] = useState<{ id: string; focus?: "lost" | "schedule" } | null>(openId ? { id: openId } : null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const userLabel = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user.label])), [users]);

  // Filtro novo no servidor traz outra lista: recomeça dela (padrão do React para props que mudam).
  const [source, setSource] = useState(initialCards);
  if (source !== initialCards) { setSource(initialCards); setCards(initialCards); }
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const columns = useMemo(() => CRM_STAGES.map((stage) => {
    const items = cards.filter((card) => crmStageOf(card.status) === stage.id);
    const value = items.reduce((sum, card) => sum + (card.vehicle?.price_cents ?? 0), 0);
    return { ...stage, items, value };
  }), [cards]);

  const updateCard = useCallback((card: CrmCard) => {
    setCards((current) => {
      if (card.status === "archived") return current.filter((item) => item.id !== card.id);
      return current.some((item) => item.id === card.id) ? current.map((item) => (item.id === card.id ? card : item)) : [card, ...current];
    });
  }, []);

  const removeCard = useCallback((id: string) => setCards((current) => current.filter((item) => item.id !== id)), []);

  async function move(id: string, stage: string) {
    const card = cards.find((item) => item.id === id);
    if (!card || crmStageOf(card.status) === stage) return;
    const previous = card.status;
    setCards((current) => current.map((item) => (item.id === id ? { ...item, status: stage, stage_changed_at: new Date().toISOString() } : item)));
    try {
      const detail = await api<CrmLeadDetail>(`/api/admin/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status: stage }) });
      updateCard(cardFromDetail(detail));
      if (stage === "lost") setOpenLead({ id, focus: "lost" });
      else if (stage === "scheduled" && !detail.scheduled_at) setOpenLead({ id, focus: "schedule" });
      else setToast({ kind: "ok", text: `${card.name} → ${LEAD_STATUS_LABELS[stage]}` });
    } catch (error) {
      setCards((current) => current.map((item) => (item.id === id ? { ...item, status: previous } : item)));
      setToast({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível mover." });
    }
  }

  function step(card: CrmCard, direction: -1 | 1) {
    const index = CRM_STAGES.findIndex((stage) => stage.id === crmStageOf(card.status));
    const target = CRM_STAGES[index + direction];
    if (target) void move(card.id, target.id);
  }

  function onDrop(event: DragEvent<HTMLElement>, stage: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragging;
    setOver(null);
    setDragging(null);
    if (id) void move(id, stage);
  }

  return (
    <>
      <div className="crm-board" aria-label="Quadro de leads">
        {columns.map((column, columnIndex) => (
          <section
            key={column.id}
            className={`crm-col tone-${column.tone}${over === column.id ? " is-over" : ""}`}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (over !== column.id) setOver(column.id); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null); }}
            onDrop={(event) => onDrop(event, column.id)}
          >
            <header className="crm-col-head">
              <div><h2>{column.label}</h2><span className="crm-count">{column.items.length}</span></div>
              {column.value > 0 && <small>{brl(column.value)} em carros</small>}
            </header>
            <div className="crm-col-body">
              {column.items.map((card) => (
                <article
                  key={card.id}
                  className={`crm-card${dragging === card.id ? " is-dragging" : ""}`}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.setData("text/plain", card.id); event.dataTransfer.effectAllowed = "move"; setDragging(card.id); }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  onClick={() => setOpenLead({ id: card.id })}
                  onKeyDown={(event) => { if (event.key === "Enter") setOpenLead({ id: card.id }); }}
                  tabIndex={0}
                  aria-label={`${card.name}, ${column.label}. Enter para abrir.`}
                >
                  <div className="crm-card-top">
                    <span className={`crm-kind kind-${card.intent || card.kind}`}>{kindLabel(card)}</span>
                    <time title={new Date(card.created_at).toLocaleString("pt-BR")}>{ago(card.stage_changed_at || card.created_at)}</time>
                  </div>
                  <strong className="crm-card-name">{card.name}</strong>
                  <span className="crm-card-phone">{card.phone}</span>
                  {card.vehicle && (
                    <div className="crm-card-vehicle">
                      {card.vehicle.image_url ? <img src={card.vehicle.image_url} alt="" loading="lazy" /> : <span className="crm-noimg"><Car size={16} /></span>}
                      <div><b title={card.vehicle.title}>{card.vehicle.title}</b><small>{card.vehicle.year} · {brl(card.vehicle.price_cents)}</small></div>
                    </div>
                  )}
                  {(card.payment_method || card.has_trade === "Sim" || card.tags.length > 0) && (
                    <div className="crm-chips">
                      {card.payment_method && <span>{card.payment_method}</span>}
                      {card.has_trade === "Sim" && <span className="trade"><Repeat size={11} />Troca</span>}
                      {card.tags.slice(0, 3).map((tag) => <span key={tag} className="tag">{tag}</span>)}
                    </div>
                  )}
                  <div className="crm-card-foot">
                    {card.scheduled_at ? <span className="crm-when"><CalendarClock size={13} />{dateTime(card.scheduled_at)}</span> : <span />}
                    <div className="crm-card-actions" onClick={(event) => event.stopPropagation()}>
                      {card.assigned_to && <span className="crm-owner" title={userLabel[card.assigned_to]}>{initials(userLabel[card.assigned_to])}</span>}
                      <button type="button" disabled={columnIndex === 0} onClick={() => step(card, -1)} aria-label="Voltar etapa" title="Voltar etapa"><ArrowLeft size={14} /></button>
                      <button type="button" disabled={columnIndex === CRM_STAGES.length - 1} onClick={() => step(card, 1)} aria-label="Avançar etapa" title="Avançar etapa"><ArrowRight size={14} /></button>
                    </div>
                  </div>
                </article>
              ))}
              {!column.items.length && <p className="crm-empty">Arraste leads para cá</p>}
            </div>
          </section>
        ))}
      </div>

      {openLead && (
        <LeadDrawer
          key={openLead.id}
          id={openLead.id}
          focus={openLead.focus}
          users={users}
          knownTags={tags}
          canDelete={canDelete}
          onClose={() => setOpenLead(null)}
          onChange={updateCard}
          onDelete={(id) => { removeCard(id); setOpenLead(null); setToast({ kind: "ok", text: "Lead apagado." }); }}
          onToast={setToast}
        />
      )}
      {toast && <div className={`crm-toast ${toast.kind}`} role="status">{toast.text}</div>}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Ficha do lead                                                       */
/* ------------------------------------------------------------------ */

function LeadDrawer({ id, focus, users, knownTags, canDelete, onClose, onChange, onDelete, onToast }: {
  id: string; focus?: "lost" | "schedule"; users: User[]; knownTags: string[]; canDelete: boolean;
  onClose: () => void; onChange: (card: CrmCard) => void; onDelete: (id: string) => void; onToast: (toast: Toast) => void;
}) {
  const [lead, setLead] = useState<CrmLeadDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [deal, setDeal] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState("");
  const [note, setNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [picking, setPicking] = useState(false);
  const scheduleRef = useRef<HTMLInputElement>(null);
  const lostRef = useRef<HTMLSelectElement>(null);

  const hydrate = useCallback((detail: CrmLeadDetail) => {
    setLead(detail);
    setContact({ name: detail.name, phone: detail.phone, email: detail.email ?? "" });
    const p = detail.payload ?? {};
    setDeal(Object.fromEntries(["paymentMethod", "downPayment", "installments", "hasTrade", "tradeVehicle", "tradeYear", "tradeMileage"].map((key) => [key, String(p[key] ?? "")])));
    setSchedule(toLocalInput(detail.scheduled_at));
  }, []);

  useEffect(() => {
    api<CrmLeadDetail>(`/api/admin/leads/${id}`).then(hydrate).catch((err: Error) => setError(err.message));
  }, [id, hydrate]);

  useEffect(() => {
    if (!lead) return;
    if (focus === "schedule") scheduleRef.current?.focus();
    if (focus === "lost") lostRef.current?.focus();
  }, [lead, focus]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !picking) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, picking]);

  async function save(body: Record<string, unknown>, label: string, okText?: string) {
    setBusy(label);
    try {
      const detail = await api<CrmLeadDetail>(`/api/admin/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      hydrate(detail);
      onChange(cardFromDetail(detail));
      if (okText) onToast({ kind: "ok", text: okText });
      return detail;
    } catch (err) {
      onToast({ kind: "error", text: err instanceof Error ? err.message : "Não foi possível salvar." });
      return null;
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!lead || !window.confirm(`Apagar definitivamente o lead de ${lead.name}? Esta ação não pode ser desfeita.`)) return;
    setBusy("delete");
    try {
      await api(`/api/admin/leads/${id}`, { method: "DELETE" });
      onDelete(id);
    } catch (err) {
      onToast({ kind: "error", text: err instanceof Error ? err.message : "Não foi possível apagar." });
      setBusy("");
    }
  }

  function addTag(raw: string) {
    const tag = raw.trim();
    if (!lead || !tag || lead.tags.includes(tag)) return;
    setTagInput("");
    void save({ tags: [...lead.tags, tag] }, "tags");
  }

  function submitNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    void save({ note }, "note").then((ok) => { if (ok) setNote(""); });
  }

  const tagSuggestions = [...new Set([...SUGGESTED_TAGS, ...knownTags])].filter((tag) => !lead?.tags.includes(tag));
  const extraPayload = lead ? Object.entries(lead.payload ?? {}).filter(([key, value]) =>
    typeof value !== "object" && value !== "" && !["paymentMethod", "downPayment", "installments", "hasTrade", "tradeVehicle", "tradeYear", "tradeMileage", "vehicleId", "vehicleTitle", "selectedVehicleLabel", "vehicleOriginType", "pageUrl", "leadSource", "intent", "financingTarget", "financingService"].includes(key)) : [];

  return (
    <div className="crm-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="crm-drawer" role="dialog" aria-modal="true" aria-label="Ficha do lead">
        <header className="crm-drawer-head">
          <div>
            {lead && <span className={`crm-kind kind-${lead.intent || lead.kind}`}>{kindLabel(lead)}</span>}
            <h2>{lead?.name ?? "Carregando…"}</h2>
            {lead && <small>Recebido em {new Date(lead.created_at).toLocaleString("pt-BR")} · protocolo {lead.id.replace(/-/g, "").slice(0, 8).toUpperCase()}</small>}
          </div>
          <button type="button" className="crm-x" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </header>

        {error && <p className="adm-feedback error">{error}</p>}
        {lead && (
          <div className="crm-drawer-body">
            <div className="crm-quick">
              <a className="ad-btn crm-wa" href={whatsapp(lead.phone, lead.name)} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a>
              <a className="ad-btn ghost" href={`tel:${lead.phone.replace(/\D/g, "")}`}><Phone size={16} />Ligar</a>
              {lead.email && <a className="ad-btn ghost" href={`mailto:${lead.email}`}><Mail size={16} />E-mail</a>}
            </div>

            <section className="crm-sec crm-grid-2">
              <label className="ad-field"><span>Etapa</span>
                <select className={`ad-status-select ${lead.status}`} value={lead.status} disabled={busy === "status"} onChange={(e) => void save({ status: e.currentTarget.value }, "status", "Etapa atualizada.")}>
                  {Object.entries(LEAD_STATUS_LABELS).filter(([value]) => value !== "qualified" || lead.status === "qualified").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="ad-field"><span>Responsável</span>
                <select value={lead.assigned_to ?? ""} disabled={busy === "owner"} onChange={(e) => void save({ assignedTo: e.currentTarget.value || null }, "owner", "Responsável atualizado.")}>
                  <option value="">Sem responsável</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.label}</option>)}
                </select>
              </label>
              {lead.status === "lost" && (
                <label className="ad-field crm-span"><span>Motivo do insucesso</span>
                  <select ref={lostRef} value={lead.lost_reason ?? ""} onChange={(e) => void save({ lostReason: e.currentTarget.value }, "lost", "Motivo salvo.")}>
                    <option value="">Selecione…</option>
                    {LOST_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
                  </select>
                </label>
              )}
            </section>

            <section className="crm-sec">
              <h3><CalendarClock size={16} />Agendamento</h3>
              <div className="crm-row">
                <input ref={scheduleRef} type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.currentTarget.value)} />
                <button type="button" className="ad-btn" disabled={busy === "schedule" || !schedule || schedule === toLocalInput(lead.scheduled_at)} onClick={() => void save({ scheduledAt: new Date(schedule).toISOString() }, "schedule", "Agendamento salvo.")}>Agendar</button>
                {lead.scheduled_at && <button type="button" className="ad-btn ghost" onClick={() => void save({ scheduledAt: null }, "schedule", "Agendamento removido.")}>Remover</button>}
              </div>
              {lead.scheduled_at && <small className="crm-hint">Marcado para {new Date(lead.scheduled_at).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</small>}
            </section>

            <section className="crm-sec">
              <h3><UserRound size={16} />Contato</h3>
              <div className="crm-grid-2">
                <label className="ad-field crm-span"><span>Nome</span><input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.currentTarget.value })} /></label>
                <label className="ad-field"><span>Telefone / WhatsApp</span><input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.currentTarget.value })} inputMode="tel" /></label>
                <label className="ad-field"><span>E-mail</span><input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.currentTarget.value })} /></label>
              </div>
              <button type="button" className="ad-btn small" disabled={busy === "contact" || (contact.name === lead.name && contact.phone === lead.phone && contact.email === (lead.email ?? ""))} onClick={() => void save(contact, "contact", "Contato atualizado.")}>Salvar contato</button>
            </section>

            <section className="crm-sec">
              <h3><Car size={16} />Carro de interesse</h3>
              {lead.vehicle ? <VehicleLine vehicle={lead.vehicle} /> : <p className="crm-hint">Nenhum carro vinculado.</p>}
              <div className="crm-row">
                <button type="button" className="ad-btn ghost small" onClick={() => setPicking(true)}>{lead.vehicle ? <><Repeat size={14} />Trocar carro</> : <><Plus size={14} />Adicionar carro</>}</button>
                {lead.vehicle && <button type="button" className="ad-btn ghost small" onClick={() => void save({ vehicleId: null }, "vehicle", "Carro removido do lead.")}>Remover</button>}
              </div>
              {picking && <VehiclePicker onClose={() => setPicking(false)} onPick={(vehicle) => { setPicking(false); void save({ vehicleId: vehicle.id }, "vehicle", "Carro de interesse atualizado."); }} />}
            </section>

            <section className="crm-sec">
              <h3><Repeat size={16} />Negociação e carro na troca</h3>
              <div className="crm-grid-2">
                <label className="ad-field"><span>Forma de pagamento</span>
                  <select value={deal.paymentMethod} onChange={(e) => setDeal({ ...deal, paymentMethod: e.currentTarget.value })}>
                    <option value="">—</option>{["À vista", "Financiamento", "Consórcio", "Ainda não sei"].map((o) => <option key={o}>{o}</option>)}
                  </select>
                </label>
                <label className="ad-field"><span>Entrada</span><input value={deal.downPayment} onChange={(e) => setDeal({ ...deal, downPayment: e.currentTarget.value })} placeholder="R$" /></label>
                <label className="ad-field"><span>Prazo</span><input value={deal.installments} onChange={(e) => setDeal({ ...deal, installments: e.currentTarget.value })} placeholder="48x" /></label>
                <label className="ad-field"><span>Tem carro na troca?</span>
                  <select value={deal.hasTrade} onChange={(e) => setDeal({ ...deal, hasTrade: e.currentTarget.value })}><option value="">—</option><option>Sim</option><option>Não</option></select>
                </label>
                {deal.hasTrade === "Sim" && (
                  <>
                    <label className="ad-field crm-span"><span>Veículo da troca</span><input value={deal.tradeVehicle} onChange={(e) => setDeal({ ...deal, tradeVehicle: e.currentTarget.value })} placeholder="Marca e modelo" /></label>
                    <label className="ad-field"><span>Ano</span><input value={deal.tradeYear} onChange={(e) => setDeal({ ...deal, tradeYear: e.currentTarget.value })} /></label>
                    <label className="ad-field"><span>Km</span><input value={deal.tradeMileage} onChange={(e) => setDeal({ ...deal, tradeMileage: e.currentTarget.value })} inputMode="numeric" /></label>
                  </>
                )}
              </div>
              <button type="button" className="ad-btn small" disabled={busy === "deal"} onClick={() => void save({ deal }, "deal", "Negociação atualizada.")}>Salvar negociação</button>
            </section>

            <section className="crm-sec">
              <h3><Tag size={16} />Etiquetas</h3>
              <div className="crm-tags">
                {lead.tags.map((tag) => (
                  <span key={tag} className="crm-tag">{tag}<button type="button" aria-label={`Remover ${tag}`} onClick={() => void save({ tags: lead.tags.filter((item) => item !== tag) }, "tags")}><X size={12} /></button></span>
                ))}
                <form className="crm-tag-add" onSubmit={(e) => { e.preventDefault(); addTag(tagInput); }}>
                  <input list="crm-tag-options" value={tagInput} onChange={(e) => setTagInput(e.currentTarget.value)} placeholder="Nova etiqueta" maxLength={30} />
                  <datalist id="crm-tag-options">{tagSuggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
                  <button type="submit" className="ad-btn small ghost" disabled={!tagInput.trim()}><Plus size={14} /></button>
                </form>
              </div>
              <div className="crm-tag-suggest">{tagSuggestions.slice(0, 8).map((tag) => <button key={tag} type="button" onClick={() => addTag(tag)}>+ {tag}</button>)}</div>
            </section>

            <section className="crm-sec">
              <h3><StickyNote size={16} />Observações e histórico</h3>
              <form className="crm-note" onSubmit={submitNote}>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.currentTarget.value)} placeholder="Ex.: ligou às 10h, pediu simulação em 48x, volta amanhã…" />
                <button className="ad-btn small" disabled={busy === "note" || !note.trim()}>Adicionar observação</button>
              </form>
              <Timeline activities={lead.activities} lead={lead} />
            </section>

            <section className="crm-sec">
              <h3>Mensagem original e origem</h3>
              <p className="crm-message">{lead.message}</p>
              <ul className="crm-facts">
                {lead.company_name && <li><b>Empresa:</b> {lead.company_name} {lead.cnpj && `· ${lead.cnpj}`}</li>}
                <li><b>Origem:</b> {lead.utm_source || lead.lead_source || "site"}{lead.utm_campaign && ` · campanha ${lead.utm_campaign}`}</li>
                {lead.page_url && <li><b>Página:</b> <a href={lead.page_url} target="_blank" rel="noreferrer">{lead.page_url.replace(/^https?:\/\/[^/]+/, "") || "/"}</a></li>}
                {extraPayload.map(([key, value]) => <li key={key}><b>{key}:</b> {String(value)}</li>)}
              </ul>
            </section>

            <footer className="crm-danger">
              {lead.status !== "archived"
                ? <button type="button" className="ad-btn ghost" onClick={() => void save({ status: "archived" }, "archive", "Lead arquivado.").then((ok) => ok && onClose())}><Archive size={16} />Arquivar</button>
                : <button type="button" className="ad-btn ghost" onClick={() => void save({ status: "new" }, "archive", "Lead reaberto.")}><Archive size={16} />Desarquivar</button>}
              {canDelete && <button type="button" className="ad-btn ghost danger" disabled={busy === "delete"} onClick={remove}><Trash2 size={16} />Apagar</button>}
            </footer>
          </div>
        )}
      </aside>
    </div>
  );
}

function VehicleLine({ vehicle }: { vehicle: CrmVehicle }) {
  return (
    <div className="crm-vehicle">
      {vehicle.image_url ? <img src={vehicle.image_url} alt="" /> : <span className="crm-noimg"><Car size={20} /></span>}
      <div>
        <b>{vehicle.title}</b>
        <small>{[vehicle.code && `#${vehicle.code}`, vehicle.year, vehicle.mileage != null && `${vehicle.mileage.toLocaleString("pt-BR")} km`].filter(Boolean).join(" · ")}</small>
        <strong>{brl(vehicle.price_cents)}</strong>
        {vehicle.status !== "published" && <small className="crm-warn">Anúncio {vehicle.status === "paused" ? "pausado" : vehicle.status}</small>}
      </div>
      <div className="crm-vehicle-links">
        <a href={`/veiculos/${vehicle.slug}`} target="_blank" rel="noreferrer" title="Ver no site"><ExternalLink size={15} /></a>
        <a href={`/admin/veiculos/${vehicle.id}`} title="Editar anúncio"><Car size={15} /></a>
      </div>
    </div>
  );
}

function VehiclePicker({ onPick, onClose }: { onPick: (vehicle: CrmVehicle) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CrmVehicle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      setLoading(true);
      api<CrmVehicle[]>(`/api/admin/vehicle-search?q=${encodeURIComponent(q)}`).then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  return (
    <div className="crm-picker">
      <div className="crm-picker-search">
        <Search size={16} />
        <input autoFocus value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder="Buscar por marca, modelo ou código…" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }} />
        <button type="button" onClick={onClose} aria-label="Fechar busca"><X size={16} /></button>
      </div>
      <div className="crm-picker-list">
        {loading && <p className="crm-hint">Buscando…</p>}
        {!loading && q.trim().length >= 2 && !results.length && <p className="crm-hint">Nenhum veículo encontrado.</p>}
        {(q.trim().length >= 2 ? results : []).map((vehicle) => (
          <button key={vehicle.id} type="button" onClick={() => onPick(vehicle)}><VehicleLine vehicle={vehicle} /></button>
        ))}
      </div>
    </div>
  );
}

const ACTIVITY_ICON: Record<string, string> = { note: "📝", stage: "➡️", edit: "✏️", schedule: "📅", vehicle: "🚗", tags: "🏷️" };

function Timeline({ activities, lead }: { activities: CrmActivity[]; lead: CrmLeadDetail }) {
  return (
    <ol className="crm-timeline">
      {activities.map((item) => (
        <li key={item.id} className={`type-${item.type}`}>
          <span aria-hidden="true">{ACTIVITY_ICON[item.type] ?? "•"}</span>
          <div>
            <p>{item.text}</p>
            <small>{new Date(item.created_at).toLocaleString("pt-BR")}{item.user_name && ` · ${item.user_name}`}</small>
          </div>
        </li>
      ))}
      <li className="type-created">
        <span aria-hidden="true">📥</span>
        <div><p>Lead recebido pelo site</p><small>{new Date(lead.created_at).toLocaleString("pt-BR")}</small></div>
      </li>
    </ol>
  );
}
