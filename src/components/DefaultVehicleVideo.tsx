"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheck, PauseCircle, PlayCircle, Trash2, Upload, Video } from "lucide-react";
import { uploadAdminMedia } from "@/lib/client-media-upload";

type VideoState = {
  url: string;
  enabled: boolean;
  stats: { published: number; custom: number; inheriting: number };
};

const emptyState: VideoState = {
  url: "",
  enabled: false,
  stats: { published: 0, custom: 0, inheriting: 0 },
};

async function readApiResponse(response: Response) {
  if (response.status === 401) {
    window.location.assign("/admin/login");
    return null;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body as VideoState;
}

export function DefaultVehicleVideo() {
  const [state, setState] = useState<VideoState>(emptyState);
  const [message, setMessage] = useState("Carregando...");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/default-vehicle-video", { cache: "no-store" })
      .then(readApiResponse)
      .then((body) => {
        if (!body) return;
        setState(body);
        setMessage("");
      })
      .catch((cause) => {
        setMessage("");
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar o vídeo padrão.");
      });
  }, []);

  async function saveVideo(nextUrl: string, enabled: boolean) {
    setBusy(true);
    setError("");
    if (!nextUrl) setMessage("Removendo vídeo padrão...");
    else if (nextUrl.includes("youtu") || nextUrl.includes("drive.google")) setMessage("Salvando link do vídeo...");
    
    try {
      const response = await fetch("/api/admin/default-vehicle-video", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nextUrl, enabled }),
      });
      const body = await readApiResponse(response);
      if (!body) return false;
      setState(body);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function uploadVideo(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("Preparando vídeo...");
    try {
      const uploadedUrl = await uploadAdminMedia(file, { kind: "video", defaultVideo: true }, (percentage) => {
        setMessage(`Enviando vídeo: ${percentage}%`);
      });
      const enableAfterUpload = state.url ? state.enabled : true;
      if (await saveVideo(uploadedUrl, enableAfterUpload)) {
        setMessage(enableAfterUpload ? "Vídeo atualizado e ativo na vitrine." : "Vídeo atualizado e mantido pausado.");
      }
    } catch (cause) {
      setMessage("");
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o vídeo.");
    } finally {
      if (input.current) input.current.value = "";
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    setBusy(true);
    setError("");
    setMessage(enabled ? "Ativando na vitrine..." : "Pausando vídeo padrão...");
    try {
      const response = await fetch("/api/admin/default-vehicle-video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const body = await readApiResponse(response);
      if (!body) return;
      setState(body);
      setMessage(
        enabled
          ? `Vídeo padrão ativado em ${body.stats.inheriting} anúncio(s).`
          : "Vídeo padrão pausado. Os vídeos próprios continuam ativos.",
      );
    } catch (cause) {
      setMessage("");
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar o status.");
    } finally {
      setBusy(false);
    }
  }

  async function removeVideo() {
    if (!window.confirm("Remover o vídeo padrão? Os vídeos próprios dos anúncios serão mantidos.")) return;
    if (await saveVideo("", false)) {
      setMessage("Vídeo padrão removido. Os vídeos próprios foram mantidos.");
    }
  }

  return (
    <section className="adm-card default-video-admin">
      <div className="default-video-heading">
        <div>
          <div className="default-video-title-row">
            <h2><Video size={20} aria-hidden="true" /> Vídeo padrão da vitrine</h2>
            <span className={`default-video-status ${state.enabled ? "active" : "paused"}`}>
              {state.enabled ? <CircleCheck size={14} aria-hidden="true" /> : <PauseCircle size={14} aria-hidden="true" />}
              {state.enabled ? "Ativo" : "Pausado"}
            </span>
          </div>
          <p>Aparece automaticamente na galeria de cada anúncio sem vídeo próprio. Vídeos individuais sempre têm prioridade.</p>
        </div>
      </div>

      <div className="default-video-stats" aria-label="Resumo dos vídeos da vitrine">
        <div><strong>{state.stats.published}</strong><span>Anúncios publicados</span></div>
        <div><strong>{state.stats.custom}</strong><span>Com vídeo próprio</span></div>
        <div><strong>{state.stats.inheriting}</strong><span>Usando o padrão</span></div>
      </div>

      {state.url ? (
        <div className="default-video-preview">
          {/youtu\.be\/|youtube\.com\//i.test(state.url) ? (
            <div style={{ background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "100px", borderRadius: "8px" }}>
              🔗 Vídeo do YouTube (Preview Indisponível Aqui)
            </div>
          ) : (
            <video src={state.url} controls preload="metadata" playsInline />
          )}
          <div>
            <strong>{state.enabled ? "Distribuição ativa" : "Arquivo guardado e pausado"}</strong>
            <p>
              {state.enabled
                ? `O vídeo aparece em ${state.stats.inheriting} anúncio(s) sem vídeo próprio.`
                : "Reative quando quiser; não será necessário enviar o arquivo novamente."}
            </p>
          </div>
        </div>
      ) : (
        <div className="default-video-empty">
          <Video size={22} aria-hidden="true" />
          <span>Nenhum vídeo padrão enviado.</span>
        </div>
      )}

      <div className="default-video-actions" style={{ flexDirection: "column", gap: "16px", alignItems: "flex-start", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
          <label style={{ fontSize: "14px", fontWeight: "bold" }}>🔗 Link do Vídeo (Recomendado)</label>
          <input
            type="url"
            placeholder="Cole o link do YouTube, Google Drive, etc. e aperte Enter..."
            className="input"
            disabled={busy}
            style={{ width: "100%", padding: "10px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = e.currentTarget.value.trim();
                if (val) {
                  void saveVideo(val, state.url ? state.enabled : true).then((ok) => {
                    if (ok) setMessage("Link do vídeo salvo e ativado na vitrine.");
                  });
                  e.currentTarget.value = "";
                }
              }
            }}
          />
          <span style={{ fontSize: "12px", color: "#666" }}>Essa é a forma mais rápida e garantida de exibir vídeos na vitrine.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%", marginTop: "8px", padding: "12px", border: "1px dashed #ccc", borderRadius: "8px" }}>
          <label style={{ fontSize: "13px", fontWeight: "bold", color: "#d97706" }}>⚠️ Envio de Arquivo Bruto (Pode ser instável)</label>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <label className={`button button-small button-outline${busy ? " is-disabled" : ""}`} style={{ flexShrink: 0 }}>
              <Upload size={15} aria-hidden="true" />
              {state.url ? "Substituir arquivo" : "Enviar MP4 (Até 500MB)"}
              <input
                ref={input}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                hidden
                disabled={busy}
                onChange={(event) => void uploadVideo(event.currentTarget.files?.[0])}
              />
            </label>
            <span style={{ fontSize: "12px", color: "#666" }}>O upload pode travar dependendo da sua internet. Se falhar, use o link do YouTube acima.</span>
          </div>
        </div>

        {state.url && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
            <button
              type="button"
              className="button button-small button-outline"
              disabled={busy}
              aria-pressed={state.enabled}
              onClick={() => void toggle(!state.enabled)}
            >
              {state.enabled ? <PauseCircle size={15} aria-hidden="true" /> : <PlayCircle size={15} aria-hidden="true" />}
              {state.enabled ? "Desativar em todos" : "Ativar para todos"}
            </button>
            <button type="button" className="button button-small button-perigo" disabled={busy} onClick={() => void removeVideo()}>
              <Trash2 size={15} aria-hidden="true" /> Remover vídeo
            </button>
          </div>
        )}
      </div>

      <p className="default-video-hint">MP4, WebM ou MOV, até 500 MB. O vídeo padrão é exibido dentro do anúncio, sem reprodução automática.</p>
      {message && <p className="veiculo-fotos-aviso" aria-live="polite">{message}</p>}
      {error && <p className="veiculo-fotos-erro" role="alert">{error}</p>}
    </section>
  );
}
