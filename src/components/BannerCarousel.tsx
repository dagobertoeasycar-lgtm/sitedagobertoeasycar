"use client";

import { useState, useEffect, useCallback } from "react";

type Banner = {
  id: number;
  title: string;
  image_url: string;
  link_url: string;
  link_target: string;
};

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const next = useCallback(() => setCurrent(c => (c + 1) % count), [count]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + count) % count), [count]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [paused, count, next]);

  if (count === 0) return null;
  const banner = banners[current];
  const slide = (
    <>
      <img src={banner.image_url} alt={banner.title || "Banner"} />
      {banner.title && (
        <div className="banner-overlay">
          <h2>{banner.title}</h2>
        </div>
      )}
    </>
  );

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
            {banners.map((_, i) => (
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
