"use client";

import { useMemo, useState, type FormEvent } from "react";
import { PARTNER_CONNECTORS, PARTNER_ORIGIN_KINDS, VEHICLE_FILTERS, whatsappLink, type Partner } from "@/lib/partners";

type Props = { partners: Partner[] };

const EMPTY = {
  id: "",
  name: "",
  tradeName: "",
  legalName: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  city: "",
  stockUrl: "",
  stockUrlAlt: "",
  originKind: "PARTNER",
  notes: "",
  connector: "",
  baseUrl: "",
  vehicleFilter: "cars",
};

type FormState = typeof EMPTY;

function toForm(partner: Partner): FormState {
  return {
    id: partner.id,
    name: partner.name ?? "",
    tradeName: partner.trade_name ?? "",
    legalName: partner.legal_name ?? "",
    cnpj: partner.cnpj ?? "",
    phone: partner.phone ?? "",
    whatsapp: partner.whatsapp ?? "",
    email: partner.email ?? "",
    city: partner.city ?? "",
    stockUrl: partner.stock_url ?? "",
    stockUrlAlt: partner.stock_url_alt ?? "",
    originKind: partner.origin_kind ?? "PARTNER",
    notes: partner.notes ?? "",
    connector: partner.connector ?? "",
    baseUrl: partner.connector_config?.baseUrl ?? "",
    vehicleFilter: partner.connector_config?.vehicleFilter ?? "cars",
  };
}

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PartnersAdmin({ partners }: Props) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return partners;
    return partners.filter((partner) =>
      [partner.name, partner.trade_name, partner.legal_name, partner.city, partner.cnpj, partner.whatsapp]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [partners, search]);

  const activeCount = partners.filter((p) => p.active).length;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setForm(EMPTY);
    setOpen(true);
    setError("");
    setMessage("");
  }

  function startEdit(partner: Partner) {
    setForm(toForm(partner));
    setOpen(true);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const editing = Boolean(form.id);
    const response = await fetch(editing ? `/api/admin/partners/${form.id}` : "/api/admin/partners", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Não foi possível salvar o parceiro.");
      return;
    }
    setMessage(editing ? "Parceiro atualizado." : "Parceiro cadastrado.");
    window.location.reload();
  }

  async function toggleActive(partner: Partner) {
    // Desligar tem consequência visível no site: o estoque do parceiro sai do
    // ar na próxima sincronização. Vale confirmar antes.
    if (partner.active && partner.connector) {
      const publicados = partner.vehicles_published ?? 0;
      const ok = window.confirm(
        `Desativar "${partner.name}"?\n\n` +
          `Na próxima atualização de estoque, ${publicados} veículo(s) deste parceiro ` +
          `serão retirados do site. Reativando, eles voltam na sincronização seguinte.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/partners/${partner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !partner.active }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Não foi possível alterar o status.");
      return;
    }
    window.location.reload();
  }

  async function remove(partner: Partner) {
    const total = partner.vehicles_total ?? 0;
    const confirmation = window.confirm(
      total > 0
        ? `"${partner.name}" tem ${total} veículo(s) vinculado(s) e não pode ser excluído. Deseja desativá-lo?`
        : `Excluir o parceiro "${partner.name}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmation) return;

    if (total > 0) {
      await toggleActive({ ...partner, active: true });
      return;
    }

    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/partners/${partner.id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Não foi possível excluir o parceiro.");
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <div className="adm-header">
        <div>
          <h1>Parceiros ({partners.length})</h1>
          <p className="adm-header-description">
            {activeCount} ativo(s). Só parceiros ativos entram na atualização de estoque — ao
            desativar, o estoque daquele parceiro sai do site na próxima sincronização.
          </p>
        </div>
        <div className="adm-header-actions">
          <button className="button button-small" onClick={startCreate} type="button">
            + Novo parceiro
          </button>
        </div>
      </div>

      {error && <p className="adm-feedback error" role="alert">{error}</p>}
      {message && <p className="adm-feedback" aria-live="polite">{message}</p>}

      {open && (
        <div className="adm-card adm-create-panel">
          <div className="adm-card-header">
            <h2>{form.id ? "Editar parceiro" : "Novo parceiro"}</h2>
            <button className="adm-link" type="button" onClick={() => setOpen(false)}>Fechar</button>
          </div>
          <form className="lead-form admin-vehicle-form" onSubmit={submit}>
            <div className="form-row">
              <label>
                <span>Nome do parceiro *</span>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} required minLength={2} />
              </label>
              <label>
                <span>Nome fantasia</span>
                <input value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Razão social</span>
                <input value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
              </label>
              <label>
                <span>CNPJ</span>
                <input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Tipo de origem</span>
                <select value={form.originKind} onChange={(e) => set("originKind", e.target.value)}>
                  {PARTNER_ORIGIN_KINDS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Cidade</span>
                <input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Osasco/SP" />
              </label>
            </div>
            <div className="form-row">
              <label>
                <span>Telefone</span>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </label>
              <label>
                <span>WhatsApp</span>
                <input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
              </label>
            </div>
            <label>
              <span>E-mail</span>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label>
              <span>URL do estoque</span>
              <input
                value={form.stockUrl}
                onChange={(e) => set("stockUrl", e.target.value)}
                placeholder="https://site-do-parceiro.com.br/estoque"
              />
            </label>
            <label>
              <span>URL alternativa</span>
              <input value={form.stockUrlAlt} onChange={(e) => set("stockUrlAlt", e.target.value)} />
            </label>
            <fieldset className="pricing-apply">
              <legend>Sincronização automática do estoque</legend>
              <p className="form-help">
                Escolhendo um adaptador, o estoque deste parceiro passa a ser importado a cada
                execução da sincronização. Deixando em branco, o parceiro funciona apenas como
                rótulo de origem para veículos cadastrados à mão.
              </p>
              <label>
                <span>Adaptador da plataforma</span>
                <select value={form.connector} onChange={(e) => set("connector", e.target.value)}>
                  <option value="">Não sincronizar automaticamente</option>
                  {PARTNER_CONNECTORS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              {form.connector && (
                <p className="form-help">
                  {PARTNER_CONNECTORS.find((c) => c.value === form.connector)?.hint}
                </p>
              )}
              {form.connector && (
                <div className="form-row">
                  <label>
                    <span>Endereço base do site *</span>
                    <input
                      value={form.baseUrl}
                      onChange={(e) => set("baseUrl", e.target.value)}
                      placeholder="https://site-do-parceiro.com.br"
                    />
                  </label>
                  <label>
                    <span>O que importar</span>
                    <select value={form.vehicleFilter} onChange={(e) => set("vehicleFilter", e.target.value)}>
                      {VEHICLE_FILTERS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </fieldset>
            <label>
              <span>Observações</span>
              <textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </label>
            <div className="adm-row-actions">
              <button className="button" disabled={busy}>{busy ? "Salvando…" : "Salvar parceiro"}</button>
              <button className="button button-outline" type="button" onClick={() => setOpen(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="adm-card">
        <div className="adm-filters">
          <input
            type="search"
            placeholder="Pesquisar por nome, cidade, CNPJ ou WhatsApp"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar parceiro"
          />
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Origem</th>
                <th>Sincronização</th>
                <th>Contato</th>
                <th>Estoque</th>
                <th>Última atualização</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((partner) => {
                const wa = whatsappLink(partner.whatsapp);
                const kind = PARTNER_ORIGIN_KINDS.find((k) => k.value === partner.origin_kind);
                return (
                  <tr key={partner.id}>
                    <td>
                      <strong>{partner.name}</strong>
                      {partner.trade_name && <><br /><small>{partner.trade_name}</small></>}
                      {partner.city && <><br /><small>{partner.city}</small></>}
                    </td>
                    <td>{kind?.label ?? "Loja parceira"}</td>
                    <td className="adm-lead-origin">
                      {partner.connector ? (
                        <>
                          <strong>{PARTNER_CONNECTORS.find((c) => c.value === partner.connector)?.label ?? partner.connector}</strong>
                          <br />
                          <small>fonte: {partner.sync_source_id}</small>
                          {partner.connector_config?.vehicleFilter === "all" && (
                            <><br /><small>importa tudo, inclusive moto</small></>
                          )}
                          {partner.last_error && (
                            <>
                              <br />
                              <span className="adm-badge paused">erro</span>{" "}
                              <small title={partner.last_error}>{partner.last_error.slice(0, 60)}</small>
                            </>
                          )}
                        </>
                      ) : (
                        <small>manual</small>
                      )}
                    </td>
                    <td>
                      {wa ? <a href={wa} target="_blank" rel="noreferrer">{partner.whatsapp}</a> : partner.phone || "—"}
                      {partner.stock_url && (
                        <>
                          <br />
                          <a href={partner.stock_url} target="_blank" rel="noreferrer">Ver estoque</a>
                        </>
                      )}
                    </td>
                    <td>
                      {partner.vehicles_published ?? 0} publicado(s)
                      <br />
                      <small>{partner.vehicles_total ?? 0} no total</small>
                    </td>
                    <td>
                      {formatDate(partner.last_sync_at)}
                      {(partner.last_found ?? 0) > 0 && (
                        <>
                          <br />
                          <small>
                            {partner.last_found} encontrados · {partner.last_imported} novos · {partner.last_changed} alterados · {partner.last_removed} removidos
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <span className={`adm-badge ${partner.active ? "published" : "paused"}`}>
                        {partner.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        <button className="button button-small" type="button" onClick={() => startEdit(partner)} disabled={busy}>
                          Editar
                        </button>
                        <button className="button button-small button-outline" type="button" onClick={() => toggleActive(partner)} disabled={busy}>
                          {partner.active ? "Desativar" : "Ativar"}
                        </button>
                        <button className="button button-small button-danger" type="button" onClick={() => remove(partner)} disabled={busy}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={8} className="adm-empty-row">
                    {partners.length ? "Nenhum parceiro encontrado para essa busca." : "Nenhum parceiro cadastrado ainda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
