export const adminImageContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const adminVideoContentTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const adminImageMaxBytes = 25 * 1024 * 1024;
export const adminVideoMaxBytes = 500 * 1024 * 1024;

export function isVercelBlobUrl(value: unknown, folder?: "vehicle-images" | "vehicle-videos") {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    const validHost = url.hostname === "blob.vercel-storage.com" || url.hostname.endsWith(".blob.vercel-storage.com");
    if (url.protocol !== "https:" || !validHost) return false;
    return folder ? url.pathname.startsWith(`/${folder}/`) : true;
  } catch {
    return false;
  }
}

export function safeUploadName(name: string, fallback: string) {
  const normalized = String(name || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-120);
  return normalized || fallback;
}
