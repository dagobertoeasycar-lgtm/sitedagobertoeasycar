import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

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

export async function saveImageFile(file: File) {
  if (file.size === 0 || file.size > imageUploadMaxBytes) throw new Error("Arquivo inválido");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = detectedImageExtension(bytes);
  if (!extension) throw new Error("Formato não permitido");

  const base = resolve(uploadsRoot);
  const filename = `${randomUUID()}.${extension}`;
  const destination = resolve(base, /* turbopackIgnore: true */ filename);
  if (!destination.startsWith(base + sep)) throw new Error("Destino inválido");
  await mkdir(base, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  return {
    filename,
    url: `/api/uploads/${filename}`,
    size: file.size,
    contentType: imageUploadContentTypes[extension],
  };
}
