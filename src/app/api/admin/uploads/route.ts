import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";

export const runtime = "nodejs";
const maxBytes = 8 * 1024 * 1024;
const uploadsRoot = "C:\\Sites\\DagobertoEasycar\\data\\uploads";

function detectedExtension(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return "png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "webp";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(4, 12)).startsWith("ftypavi")) return "avif";
  return null;
}

export async function POST(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > maxBytes) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = detectedExtension(bytes);
  if (!extension) return NextResponse.json({ error: "Formato não permitido" }, { status: 415 });
  const base = resolve(uploadsRoot);
  const filename = `${randomUUID()}.${extension}`;
  const destination = resolve(base, /* turbopackIgnore: true */ filename);
  if (!destination.startsWith(base + sep)) return NextResponse.json({ error: "Destino inválido" }, { status: 400 });
  await mkdir(base, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  return NextResponse.json({ url: `/api/uploads/${filename}` }, { status: 201 });
}
