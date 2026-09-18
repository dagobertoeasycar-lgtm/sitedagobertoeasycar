"use client";

import { useState, useEffect, useCallback } from "react";

type Banner = {
  id: number;
  title: string;
  image_url: string;
  link_url: string;
  link_target: string;
};

export function BannerCarousel({ banners, intervalSeconds = 5 }: { banners: Banner[]; intervalSeconds?: number }) {
  const slides = banners.length ? banners : [{ id: 0, title: "Em breve", image_url: "/em-breve.png", link_url: "", link_target: "_self" }];
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const safeIntervalSeconds = Number.isFinite(intervalSeconds)
    ? Math.min(300, Math.max(1, Math.round(intervalSeconds)))
    : 5;

  const next = useCallback(() => setCurrent(c => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(next, safeIntervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [paused, count, next, safeIntervalSeconds]);

  if (count === 0) return null;
  const banner = slides[current];
  // O titulo NAO e desenhado por cima da arte: as artes ja trazem o texto
  // queimado na imagem, e a faixa escura repetia a mesma frase embaixo.
  // Ele continua servindo para identificar o banner no /admin/banners e
  // como texto alternativo da imagem.
  const slide = <img src={banner.image_url} alt={banner.title || "Banner"} />;

  return (
    <div
      className="banner-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {banner.link_url ? (
        <a href={banner.link_url} target={banner.link_target} rel="noreferrer" className="banner-slide">
          {slide}
        </a>
      ) : (
        <div className="banner-slide">{slide}</div>
      )}

      {count > 1 && (
        <>
          <button className="banner-nav banner-prev" onClick={prev} aria-label="Anterior">&#8249;</button>
          <button className="banner-nav banner-next" onClick={next} aria-label="Próximo">&#8250;</button>
          <div className="banner-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`banner-dot${i === current ? " active" : ""}`}
                onClick={() => setCurrent(i)}
                aria-label={`Banner ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
