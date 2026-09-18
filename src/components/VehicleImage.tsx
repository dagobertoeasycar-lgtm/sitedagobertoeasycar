"use client";

import { useEffect, useRef, useState } from "react";

export function VehicleImage({ src, alt, loading = "lazy" }: { src: string; alt: string; loading?: "eager" | "lazy" }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // An image can fail before React attaches the error listener during hydration.
    const frame = requestAnimationFrame(() => {
      if (image.current?.complete && image.current.naturalWidth === 0) setFailedSrc(src);
    });
    return () => cancelAnimationFrame(frame);
  }, [src]);
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img ref={image} src={failedSrc === src ? "/em-breve.jpg" : src} alt={alt} loading={loading} onError={() => setFailedSrc(src)} />
  );
}
