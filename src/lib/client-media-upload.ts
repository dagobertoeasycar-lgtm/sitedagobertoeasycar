"use client";

import { uploadPresigned } from "@vercel/blob/client";
import {
  adminImageContentTypes,
  adminImageMaxBytes,
  adminVideoContentTypes,
  adminVideoMaxBytes,
  safeUploadName,
} from "@/lib/media-upload";

type UploadTarget =
  | { kind: "image"; vehicleId?: string }
  | { kind: "video"; vehicleId?: string; defaultVideo?: boolean };

async function uploadImageThroughServer(file: File, onProgress?: (percentage: number) => void) {
  const form = new FormData();
  form.set("file", file);
  onProgress?.(10);
  const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
  const result = await response.json().catch(() => null) as { url?: string; error?: string } | null;
  if (!response.ok || !result?.url) throw new Error(result?.error || "Não foi possível enviar a foto.");
  onProgress?.(100);
  return result.url;
}

export async function uploadAdminMedia(
  file: File,
  target: UploadTarget,
  onProgress?: (percentage: number) => void,
) {
  const isVideo = target.kind === "video";
  const allowedTypes: readonly string[] = isVideo ? adminVideoContentTypes : adminImageContentTypes;
  const maximum = isVideo ? adminVideoMaxBytes : adminImageMaxBytes;
  if (!allowedTypes.includes(file.type)) {
    throw new Error(isVideo ? "Use um vídeo MP4, WebM ou MOV." : "Use uma foto JPG, PNG, WebP ou AVIF.");
  }
  if (!file.size || file.size > maximum) {
    throw new Error(isVideo ? "O vídeo deve ter no máximo 500 MB." : "A foto deve ter no máximo 25 MB.");
  }

  const folder = isVideo ? "vehicle-videos" : "vehicle-images";
  const scope = target.kind === "video" && target.defaultVideo ? "default" : target.vehicleId || "manual";
  const filename = safeUploadName(file.name, isVideo ? "video.mp4" : "foto.jpg");
  const pathname = `${folder}/${scope}/${Date.now()}-${filename}`;
  const multipart = isVideo || file.size > 10 * 1024 * 1024;
  
  if (!isVideo) {
    return uploadImageThroughServer(file, onProgress);
  }

  try {
    const blob = await uploadPresigned(pathname, file, {
      access: "public",
      contentType: file.type,
      handleUploadUrl: "/api/admin/blob-upload",
      clientPayload: JSON.stringify(target),
      multipart,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });
    return blob.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!isVideo && message.includes("retrieve the presigned URL")) {
      return uploadImageThroughServer(file, onProgress);
    }
    throw error;
  }
}
