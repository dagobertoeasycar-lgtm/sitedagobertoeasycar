export type GalleryMediaItem = { type: "video" | "image"; url: string };

export function parseGalleryMedia(raw: unknown, fallback: string): GalleryMediaItem[] {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = [];
    }
  }

  const parsed = Array.isArray(data)
    ? data.map((item: unknown) => {
        if (typeof item === "string" && item.trim()) {
          return { type: "image" as const, url: item.trim() };
        }
        if (item && typeof item === "object" && "url" in item) {
          const candidate = item as Record<string, unknown>;
          if (typeof candidate.url !== "string" || !candidate.url.trim()) return null;
          return {
            type: candidate.type === "video" ? "video" as const : "image" as const,
            url: candidate.url.trim(),
          };
        }
        return null;
      }).filter((item): item is GalleryMediaItem => item !== null)
    : [];

  return parsed.length ? parsed : [{ type: "image", url: fallback }];
}

export function orderVehicleGallery(images: unknown, fallback: string, videoUrl = "") {
  const parsed = parseGalleryMedia(images, fallback);
  const configuredVideo = videoUrl.trim();
  const videos: GalleryMediaItem[] = configuredVideo ? [{ type: "video", url: configuredVideo }] : [];
  const photos: GalleryMediaItem[] = [];
  const seen = new Set(configuredVideo ? [`video:${configuredVideo}`] : []);

  for (const item of parsed) {
    const key = `${item.type}:${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.type === "video") videos.push(item);
    else photos.push(item);
  }

  return [...videos, ...photos];
}
