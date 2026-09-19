"use client";

import { upload } from "@vercel/blob/client";
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
  const blob = await upload(pathname, file, {
    access: "public",
    contentType: file.type,
    handleUploadUrl: "/api/admin/blob-upload",
    clientPayload: JSON.stringify(target),
    multipart: isVideo || file.size > 10 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
  });
  return blob.url;
}
