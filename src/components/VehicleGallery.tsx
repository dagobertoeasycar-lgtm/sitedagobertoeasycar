"use client";

import { useState, useEffect, useCallback } from "react";
import { orderVehicleGallery, type GalleryMediaItem } from "@/lib/vehicle-gallery-media";

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

function VideoPlayer({ url, autoplay = false }: { url: string; autoplay?: boolean }) {
  if (/youtu\.be\/|youtube\.com\//i.test(url)) return <YouTubeEmbed url={url} autoplay={autoplay} />;
  return (
    <video
      className="vehicle-gallery-video"
      src={url}
      controls
      playsInline
      preload="metadata"
      autoPlay={autoplay}
      muted={autoplay}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

function Lightbox({ media, startIndex, title, onClose }: {
  media: GalleryMediaItem[]; startIndex: number; title: string; onClose: () => void;
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
            <VideoPlayer url={item.url} autoplay />
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

export function VehicleGallery({ images, title, fallback, videoUrl = "" }: { images: unknown; title: string; fallback: string; videoUrl?: string }) {
  const media = orderVehicleGallery(images, fallback, videoUrl);
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const item = media[current];

  return (
    <>
      <div className="vehicle-gallery">
        <div
          className={`vehicle-gallery-main${item.type === "video" ? " has-video" : ""}`}
          onClick={() => { if (item.type === "image") setLightbox(current); }}
        >
          {item.type === "video" ? (
            <>
              <VideoPlayer url={item.url} />
              <span className="gallery-video-label">Vídeo</span>
            </>
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
              <button
                key={`${m.type}-${m.url}`}
                className={i === current ? "active" : ""}
                onClick={() => setCurrent(i)}
                aria-label={m.type === "video" ? "Abrir vídeo do veículo" : `Abrir foto ${i + 1} do veículo`}
                title={m.type === "video" ? "Vídeo do veículo" : `Foto ${i + 1}`}
              >
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
