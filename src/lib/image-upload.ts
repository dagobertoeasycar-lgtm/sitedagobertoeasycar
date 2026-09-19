import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { put } from "@vercel/blob";
import { getVercelBlobToken } from "@/lib/vercel-blob-token";

export const imageUploadMaxBytes = 8 * 1024 * 1024;
export const imageUploadContentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export const uploadsRoot =
  process.env.UPLOAD_DIR || (process.env.VERCEL ? "/tmp/autodrive-uploads" : "C:\\Sites\\DagobertoEasycar\\data\\uploads");

export function detectedImageExtension(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 12)).startsWith("ftypavi")) return "avif";
  return null;
}

export async function saveImageFile(file: File, maximumSizeInBytes = imageUploadMaxBytes) {
  if (file.size === 0 || file.size > maximumSizeInBytes) throw new Error("Arquivo inválido");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const extension = detectedImageExtension(bytes);
  if (!extension) throw new Error("Formato não permitido");

  const filename = `${randomUUID()}.${extension}`;
  const contentType = imageUploadContentTypes[extension];

  const blobToken = getVercelBlobToken();
  if (blobToken && !process.env.UPLOAD_DIR) {
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token: blobToken,
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

  const base = resolve(uploadsRoot);
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
