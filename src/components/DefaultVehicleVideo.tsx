"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Video, X } from "lucide-react";
import { uploadAdminMedia } from "@/lib/client-media-upload";

export function DefaultVehicleVideo() {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("Carregando...");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/default-vehicle-video", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/admin/login");
          return null;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        return body as { url?: string };
      })
      .then((body) => {
        if (!body) return;
        setUrl(body.url || "");
        setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível carregar o vídeo padrão."));
  }, []);

  async function salvar(nextUrl: string) {
    const response = await fetch("/api/admin/default-vehicle-video", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: nextUrl }),
    });
    if (response.status === 401) {
      window.location.assign("/admin/login");
      return false;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    setUrl(body.url || "");
    return true;
  }

  async function enviar(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMessage("Preparando vídeo...");
    try {
      const uploadedUrl = await uploadAdminMedia(file, { kind: "video", defaultVideo: true }, (percentage) => {
        setMessage(`Enviando vídeo: ${percentage}%`);
      });
      if (await salvar(uploadedUrl)) setMessage("Vídeo padrão atualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o vídeo.");
    } finally {
      if (input.current) input.current.value = "";
      setBusy(false);
    }
  }

  async function remover() {
    setBusy(true);
    setMessage("Removendo vídeo padrão...");
    try {
      if (await salvar("")) setMessage("Vídeo padrão removido. Os vídeos próprios foram mantidos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover o vídeo padrão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adm-card default-video-admin">
      <div className="adm-card-header">
        <div>
          <h2><Video size={19} aria-hidden="true" /> Vídeo padrão dos anúncios</h2>
          <p>Usado em todos os veículos que não possuem um vídeo próprio.</p>
        </div>
        <div className="veiculo-fotos-botoes">
          <label className="button button-small">
            <Upload size={14} aria-hidden="true" />
            {url ? "Substituir vídeo" : "Enviar vídeo"}
            <input
              ref={input}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              hidden
              disabled={busy}
              onChange={(event) => void enviar(event.currentTarget.files?.[0])}
            />
          </label>
          {url && (
            <button type="button" className="button button-small button-perigo" disabled={busy} onClick={() => void remover()}>
              <X size={14} aria-hidden="true" /> Remover padrão
            </button>
          )}
        </div>
      </div>
      {url && <video src={url} controls preload="metadata" playsInline />}
      <p className="default-video-hint">Formatos: MP4, WebM ou MOV. Limite: 500 MB.</p>
      {message && <p className="veiculo-fotos-aviso" aria-live="polite">{message}</p>}
    </section>
  );
}
