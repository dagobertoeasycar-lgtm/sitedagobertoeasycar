"use client";

import { useState, useEffect, useCallback } from "react";

type MediaItem = { type: "video" | "image"; url: string };

function parseMedia(raw: unknown, fallback: string): MediaItem[] {
  let data = raw;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return [{ type: "image", url: fallback }]; }
  }
  if (!Array.isArray(data) || data.length === 0) return [{ type: "image", url: fallback }];
  return data.map((item: unknown) => {
    if (typeof item === "string") return { type: "image" as const, url: item };
    if (item && typeof item === "object" && "url" in item) {
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.url !== "string") return null;
      return {
        type: candidate.type === "video" ? "video" as const : "image" as const,
        url: candidate.url,
      };
    }
    return null;
  }).filter(Boolean) as MediaItem[];
}

function YouTubeEmbed({ url, autoplay = false }: { url: string; autoplay?: boolean }) {
  let videoId = "";
  const s = url.match(/youtu\.be\/([^?&]+)/);
  const l = url.match(/[?&]v=([^?&]+)/);
  if (s) videoId = s[1]; else if (l) videoId = l[1]; else return null;
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}?rel=0${autoplay ? "&autoplay=1" : ""}`}
      title="Vídeo do veículo"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}

function Lightbox({ media, startIndex, title, onClose }: {
  media: MediaItem[]; startIndex: number; title: string; onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const item = media[idx];

  const prev = useCallback(() => setIdx(i => (i - 1 + media.length) % media.length), [media.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % media.length), [media.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handler); };
  }, [onClose, prev, next]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Fechar">&times;</button>
      <span className="lightbox-counter">{idx + 1} / {media.length}</span>
      <div className="lightbox-main" onClick={e => e.stopPropagation()}>
        {media.length > 1 && <button className="lightbox-nav prev" onClick={prev} aria-label="Anterior">&#8249;</button>}
        {item.type === "video" ? (
          <div style={{ position: "relative", width: "min(900px, 85vw)", aspectRatio: "16/9" }}>
            <YouTubeEmbed url={item.url} autoplay />
          </div>
        ) : (
          <img src={item.url} alt={`${title} - ${idx + 1}`} />
        )}
        {media.length > 1 && <button className="lightbox-nav next" onClick={next} aria-label="Próxima">&#8250;</button>}
      </div>
      <div className="lightbox-thumbs" onClick={e => e.stopPropagation()}>
        {media.map((m, i) => (
          <button key={i} className={i === idx ? "active" : ""} onClick={() => setIdx(i)}>
            {m.type === "video" ? (
              <span className="lightbox-thumb-video">&#9654;</span>
            ) : (
              <img src={m.url.replace("/1440x0/", "/200x150/")} alt="" loading="lazy" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function VehicleGallery({ images, title, fallback }: { images: unknown; title: string; fallback: string }) {
  const media = parseMedia(images, fallback);
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const item = media[current];

  return (
    <>
      <div className="vehicle-gallery">
        <div className="vehicle-gallery-main" onClick={() => setLightbox(current)} style={{ cursor: "zoom-in" }}>
          {item.type === "video" ? (
            <YouTubeEmbed url={item.url} />
          ) : (
            <img src={item.url} alt={`${title} - foto ${current + 1}`} loading="eager" />
          )}
          {media.length > 1 && (
            <>
              <button className="gallery-nav gallery-prev" onClick={e => { e.stopPropagation(); setCurrent(c => (c - 1 + media.length) % media.length); }}>&#8249;</button>
              <button className="gallery-nav gallery-next" onClick={e => { e.stopPropagation(); setCurrent(c => (c + 1) % media.length); }}>&#8250;</button>
              <span className="gallery-counter">{current + 1} / {media.length}</span>
            </>
          )}
        </div>
        {media.length > 1 && (
          <div className="vehicle-gallery-thumbs">
            {media.map((m, i) => (
              <button key={i} className={i === current ? "active" : ""} onClick={() => setCurrent(i)}>
                {m.type === "video" ? <span className="thumb-video">&#9654;</span> :
                  <img src={m.url.replace("/1440x0/", "/200x150/")} alt="" loading="lazy" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {lightbox !== null && <Lightbox media={media} startIndex={lightbox} title={title} onClose={() => setLightbox(null)} />}
    </>
  );
}
