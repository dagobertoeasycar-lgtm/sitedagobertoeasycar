"use client";

import { useState, type FormEvent } from "react";
// Tudo de @/lib/pricing, que não importa banco. Ver comentário em pricing.ts.
import {
  computePublishedPriceCents,
  formatCents,
  resolveMarkupCents,
  type PricingRule,
  type StockRule,
} from "@/lib/pricing";

type Props = { pricing: PricingRule; stock: StockRule };

/** Centavos ⇄ reais só na borda da interface; o banco guarda centavos. */
const toReais = (cents: number) => String(Math.round((Number(cents) || 0) / 100));
const toCents = (reais: string) => Math.max(0, Math.round((Number(reais) || 0) * 100));

export function PricingRuleForm({ pricing, stock }: Props) {
  const [mode, setMode] = useState<PricingRule["mode"]>(pricing.mode);
  const [min, setMin] = useState(toReais(pricing.min_cents));
  const [max, setMax] = useState(toReais(pricing.max_cents));
  const [fixed, setFixed] = useState(toReais(pricing.fixed_cents));
  const [round, setRound] = useState(toReais(pricing.round_to_cents));
  const [applyPartner, setApplyPartner] = useState(pricing.apply_to.includes("PARTNER"));
  const [applyPrivate, setApplyPrivate] = useState(pricing.apply_to.includes("PRIVATE"));
  const [applyOwn, setApplyOwn] = useState(pricing.apply_to.includes("OWN"));
  const [checks, setChecks] = useState(String(stock.missing_checks_before_inactive));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const current: PricingRule = {
    mode,
    min_cents: toCents(min),
    max_cents: toCents(max),
    fixed_cents: toCents(fixed),
    round_to_cents: toCents(round),
    apply_to: [
      ...(applyOwn ? (["OWN"] as const) : []),
      ...(applyPartner ? (["PARTNER"] as const) : []),
      ...(applyPrivate ? (["PRIVATE"] as const) : []),
    ],
  };

  // Simulação ao vivo com um preço de parceiro real do estoque.
  const sampleOrigin = 6790000;
  const sampleMarkup = resolveMarkupCents(current, { originPriceCents: sampleOrigin, originType: "PARTNER" });
  const samplePublished = computePublishedPriceCents(sampleOrigin, sampleMarkup);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    const response = await fetch("/api/admin/pricing-rule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pricing: current,
        stock: { missing_checks_before_inactive: Number(checks) || 2 },
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Não foi possível salvar a regra.");
      return;
    }
    setStatus("Regra salva. Ela vale a partir da próxima sincronização.");
  }

  return (
    <form className="lead-form admin-vehicle-form" onSubmit={submit}>
      {error && <p className="adm-feedback error" role="alert">{error}</p>}
      {status && <p className="adm-feedback" aria-live="polite">{status}</p>}

      <label>
        <span>Como aplicar o acréscimo</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as PricingRule["mode"])}>
          <option value="range">Faixa entre mínimo e máximo</option>
          <option value="fixed">Valor fixo</option>
          <option value="none">Não aplicar acréscimo</option>
        </select>
      </label>

      {mode === "range" && (
        <>
          <div className="form-row">
            <label>
              <span>Acréscimo mínimo (R$)</span>
              <input type="number" min={0} step={100} value={min} onChange={(e) => setMin(e.target.value)} />
            </label>
            <label>
              <span>Acréscimo máximo (R$)</span>
              <input type="number" min={0} step={100} value={max} onChange={(e) => setMax(e.target.value)} />
            </label>
          </div>
          <label>
            <span>Arredondar o preço final para múltiplos de (R$)</span>
            <input type="number" min={0} step={10} value={round} onChange={(e) => setRound(e.target.value)} />
          </label>
        </>
      )}

      {mode === "fixed" && (
        <label>
          <span>Acréscimo fixo (R$)</span>
          <input type="number" min={0} step={100} value={fixed} onChange={(e) => setFixed(e.target.value)} />
        </label>
      )}

      <fieldset className="pricing-apply">
        <legend>Aplicar em quais origens</legend>
        <label className="consent">
          <input type="checkbox" checked={applyPartner} onChange={(e) => setApplyPartner(e.target.checked)} />
          <span>Loja parceira</span>
        </label>
        <label className="consent">
          <input type="checkbox" checked={applyPrivate} onChange={(e) => setApplyPrivate(e.target.checked)} />
          <span>Venda particular</span>
        </label>
        <label className="consent">
          <input type="checkbox" checked={applyOwn} onChange={(e) => setApplyOwn(e.target.checked)} />
          <span>Estoque próprio</span>
        </label>
      </fieldset>

      <div className="adm-card pricing-preview">
        <strong>Simulação</strong>
        <p>
          Veículo de parceiro a {formatCents(sampleOrigin)} → acréscimo de{" "}
          <strong>{formatCents(sampleMarkup)}</strong> → publicado por{" "}
          <strong>{formatCents(samplePublished)}</strong>.
        </p>
        <small>O preço de origem continua guardado e nunca é sobrescrito.</small>
      </div>

      <label>
        <span>Verificações sem encontrar o veículo antes de marcar como indisponível</span>
        <input type="number" min={1} max={10} value={checks} onChange={(e) => setChecks(e.target.value)} />
      </label>

      <div className="adm-row-actions">
        <button className="button" disabled={busy}>{busy ? "Salvando…" : "Salvar regra"}</button>
      </div>
    </form>
  );
}
