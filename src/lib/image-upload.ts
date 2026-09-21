import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { put } from "@vercel/blob";
import { getVercelBlobToken, hasVercelBlobCredentials } from "@/lib/vercel-blob-token";

export const imageUploadMaxBytes = 8 * 1024 * 1024;

/** Extensões de mídia aceitas pelo upload. Vídeos ficam fora por enquanto. */
export const imageUploadContentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export function detectedImageExtension(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 12)).startsWith("ftypavi")) return "avif";
  return null;
}

/**
 * Detecta se o arquivo é vídeo pelos magic bytes.
 * Usado para rejeitar com mensagem clara ao invés de erro genérico.
 */
export function isVideoFile(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const head4 = new TextDecoder().decode(bytes.slice(0, 4));
  const ftyp = new TextDecoder().decode(bytes.slice(4, 8));
  // MP4/MOV: ftyp box
  if (ftyp === "ftyp") return true;
  // AVI
  if (head4 === "RIFF" && bytes.length >= 12 && new TextDecoder().decode(bytes.slice(8, 12)) === "AVI ") return true;
  // WebM/MKV (EBML header: 0x1A 0x45 0xDF 0xA3)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
  return false;
}

export async function saveImageFile(file: File, maximumSizeInBytes = imageUploadMaxBytes) {
  if (file.size === 0 || file.size > maximumSizeInBytes) {
    throw new Error(`Arquivo inválido (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é ${Math.round(maximumSizeInBytes / 1024 / 1024)} MB.`);
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (isVideoFile(bytes)) {
    throw new Error("Vídeos não são aceitos no upload. Use um link do YouTube no campo de vídeo.");
  }

  const extension = detectedImageExtension(bytes);
  if (!extension) throw new Error("Formato não permitido. Aceitos: JPG, PNG, WebP, AVIF.");

  const filename = `${randomUUID()}.${extension}`;
  const contentType = imageUploadContentTypes[extension];

  const blobToken = getVercelBlobToken();
  if (hasVercelBlobCredentials() && !process.env.UPLOAD_DIR) {
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      ...(blobToken ? { token: blobToken } : {}),
    });
    return {
      filename,
      url: blob.url,
      size: file.size,
      contentType,
    };
  }

  if (process.env.VERCEL && !process.env.UPLOAD_DIR) {
    throw new Error("O armazenamento de fotos não está conectado ao projeto na Vercel.");
  }

  const base = resolve(process.env.UPLOAD_DIR || "data/uploads");
  const destination = resolve(base, /* turbopackIgnore: true */ filename);
  if (!destination.startsWith(base + sep)) throw new Error("Destino inválido");
  await mkdir(base, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  return {
    filename,
    url: `/api/uploads/${filename}`,
    size: file.size,
    contentType,
  };
}

