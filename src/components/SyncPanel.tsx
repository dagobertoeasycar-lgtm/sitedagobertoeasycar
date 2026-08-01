"use client";

import { useCallback, useEffect, useState } from "react";

type SyncRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

type SyncStatus = {
  enabled: boolean;
  intervalMinutes: number;
  lastRuns: SyncRun[];
  running: boolean;
};

export function SyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync");
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void fetchStatus(), 0);
    const interval = setInterval(fetchStatus, 10_000); // poll every 10s
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  async function doAction(action: string, value?: string) {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value }),
      });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "Erro");
      else if (action === "sync") setMsg("Sincronização iniciada...");
      else setMsg("Salvo!");
      await fetchStatus();
    } catch {
      setMsg("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  if (!status) return <div className="sync-panel"><p>Carregando status do sync...</p></div>;

  const last = status.lastRuns[0];
  const lastTime = last?.finished_at
    ? new Date(last.finished_at).toLocaleString("pt-BR")
    : last?.started_at
      ? "Em andamento..."
      : "Nunca executado";

  return (
    <div className="sync-panel">
      <div className="sync-header">
        <h2>Sincronização EasyCar</h2>
        <span className={`sync-badge ${status.enabled ? "active" : "inactive"}`}>
          {status.enabled ? "Ativa" : "Pausada"}
        </span>
      </div>

      <div className="sync-info">
        <div className="sync-stat">
          <span>Última sync</span>
          <strong>{lastTime}</strong>
        </div>
        {last?.finished_at && (
          <>
            <div className="sync-stat">
              <span>Processados</span>
              <strong>{last.processed}</strong>
            </div>
            <div className="sync-stat">
              <span>Novos</span>
              <strong style={{ color: last.created > 0 ? "#16a34a" : undefined }}>{last.created}</strong>
            </div>
            <div className="sync-stat">
              <span>Atualizados</span>
              <strong>{last.updated}</strong>
            </div>
            <div className="sync-stat">
              <span>Removidos</span>
              <strong>{last.skipped}</strong>
            </div>
            {last.errors > 0 && (
              <div className="sync-stat">
                <span>Erros</span>
                <strong style={{ color: "#dc2626" }}>{last.errors}</strong>
              </div>
            )}
          </>
        )}
      </div>

      <div className="sync-controls">
        <button
          className="button"
          onClick={() => doAction("sync")}
          disabled={loading || status.running}
        >
          {status.running ? "Sincronizando..." : "Sincronizar agora"}
        </button>

        <button
          className={`button ${status.enabled ? "button-outline" : ""}`}
          onClick={() => doAction("toggle")}
          disabled={loading}
        >
          {status.enabled ? "Pausar sync automático" : "Ativar sync automático"}
        </button>

        <label className="sync-interval">
          Intervalo (min):
          <select
            defaultValue={status.intervalMinutes}
            onChange={(e) => doAction("interval", e.target.value)}
            disabled={loading}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="30">30</option>
            <option value="60">60</option>
          </select>
        </label>
      </div>

      {msg && <p className="sync-msg">{msg}</p>}

      {status.lastRuns.length > 1 && (
        <details className="sync-history">
          <summary>Histórico recente</summary>
          <table>
            <thead>
              <tr><th>Início</th><th>Proc.</th><th>Novos</th><th>Atual.</th><th>Erros</th><th>Duração</th></tr>
            </thead>
            <tbody>
              {status.lastRuns.map((r) => {
                const dur = r.finished_at
                  ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)
                  : null;
                return (
                  <tr key={r.id}>
                    <td>{new Date(r.started_at).toLocaleString("pt-BR")}</td>
                    <td>{r.processed}</td>
                    <td>{r.created}</td>
                    <td>{r.updated}</td>
                    <td>{r.errors}</td>
                    <td>{dur !== null ? `${dur}s` : "..."}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}
