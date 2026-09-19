"use client";

import { useEffect, useState } from "react";
import { Clock3, Save, ShieldCheck } from "lucide-react";
import { formatSessionDuration } from "@/lib/session-policy";

type SettingsResponse = {
  enabled: boolean;
  minutes: number;
  expiresAt: number | null;
};

const durationOptions = [
  15,
  30,
  60,
  120,
  240,
  480,
  720,
  1440,
  2880,
  10080,
];

async function readApiResponse(response: Response) {
  if (response.status === 401) {
    window.location.assign("/admin/login");
    return null;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body as SettingsResponse;
}

export function SessionTimeoutSettings() {
  const [settings, setSettings] = useState<SettingsResponse>({ enabled: true, minutes: 480, expiresAt: null });
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("Carregando...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/session-settings", { cache: "no-store" })
      .then(readApiResponse)
      .then((body) => {
        if (!body) return;
        setSettings(body);
        setMessage("");
      })
      .catch((cause) => {
        setMessage("");
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar a configuração.");
      })
      .finally(() => setBusy(false));
  }, []);

  async function save() {
    setBusy(true);
    setMessage("Salvando configuração...");
    setError("");
    try {
      const response = await fetch("/api/admin/session-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: settings.enabled, minutes: settings.minutes }),
      });
      const body = await readApiResponse(response);
      if (!body) return;
      setSettings(body);
      window.dispatchEvent(new CustomEvent("autodrive:session-updated", { detail: { expiresAt: body.expiresAt } }));
      setMessage(
        body.enabled
          ? `Encerramento automático ativo após ${formatSessionDuration(body.minutes)} sem atividade.`
          : "Encerramento automático desativado. A sessão termina somente ao clicar em Sair.",
      );
    } catch (cause) {
      setMessage("");
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a configuração.");
    } finally {
      setBusy(false);
    }
  }

  const hasCustomDuration = !durationOptions.includes(settings.minutes);

  return (
    <section className="adm-card session-settings-card">
      <div className="session-settings-heading">
        <div>
          <h2><ShieldCheck size={20} aria-hidden="true" /> Segurança da sessão</h2>
          <p>Controle quando o painel deve encerrar o acesso administrativo por falta de atividade.</p>
        </div>
        <span className={`session-settings-status ${settings.enabled ? "active" : "inactive"}`}>
          {settings.enabled ? "Encerramento ativo" : "Sem tempo automático"}
        </span>
      </div>

      <div className="session-settings-controls">
        <label className="session-toggle">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={busy}
            onChange={(event) => setSettings((current) => ({ ...current, enabled: event.currentTarget.checked }))}
          />
          <span className="session-toggle-track" aria-hidden="true"><span /></span>
          <span>
            <strong>Deslogar automaticamente</strong>
            <small>O tempo é renovado enquanto houver atividade no painel.</small>
          </span>
        </label>

        <label className="session-duration-field">
          <span><Clock3 size={15} aria-hidden="true" /> Tempo sem atividade</span>
          <select
            value={settings.minutes}
            disabled={busy || !settings.enabled}
            onChange={(event) => setSettings((current) => ({ ...current, minutes: Number(event.currentTarget.value) }))}
          >
            {hasCustomDuration && <option value={settings.minutes}>{formatSessionDuration(settings.minutes)}</option>}
            {durationOptions.map((minutes) => (
              <option key={minutes} value={minutes}>{formatSessionDuration(minutes)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="session-settings-note">
        {settings.enabled
          ? `Sem atividade por ${formatSessionDuration(settings.minutes)}, a sessão é encerrada e volta para a tela de login.`
          : "Com o tempo desativado, o painel permanece conectado até usar o botão Sair. Esta opção vale para os próximos logins e para a sessão atual."}
      </div>

      <div className="session-settings-actions">
        <button type="button" className="button button-small" disabled={busy} onClick={() => void save()}>
          <Save size={15} aria-hidden="true" /> {busy ? "Salvando..." : "Salvar configuração"}
        </button>
        {message && <span className="veiculo-fotos-aviso" aria-live="polite">{message}</span>}
        {error && <span className="veiculo-fotos-erro" role="alert">{error}</span>}
      </div>
    </section>
  );
}
