"use client";

import Image from "next/image";
import { useState } from "react";

export function VehicleGallery({ images, title, fallback }: { images: string[]; title: string; fallback: string }) {
  const photos = images.length > 0 ? images : [fallback];
  const [current, setCurrent] = useState(0);

  return (
    <div className="vehicle-gallery">
      <div className="vehicle-gallery-main">
        <Image
          src={photos[current]}
          alt={`${title} - foto ${current + 1}`}
          fill
          priority
          sizes="(max-width: 760px) 100vw, 60vw"
          style={{ objectFit: "cover" }}
        />
      </div>
      {photos.length > 1 && (
        <div className="vehicle-gallery-thumbs">
          {photos.map((src, i) => (
            <button
              key={i}
              className={i === current ? "active" : ""}
              onClick={() => setCurrent(i)}
              aria-label={`Foto ${i + 1}`}
            >
              <Image src={src} alt={`${title} - miniatura ${i + 1}`} fill sizes="80px" style={{ objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
