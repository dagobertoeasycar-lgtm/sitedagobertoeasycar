import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { NextResponse } from "next/server";
import { imageUploadContentTypes, uploadsRoot } from "@/lib/image-upload";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[0-9a-f-]+\.(jpg|png|webp|avif)$/.test(name)) return new NextResponse("Não encontrado", { status: 404 });
  const base = resolve(uploadsRoot);
  const filePath = resolve(base, /* turbopackIgnore: true */ name);
  if (!filePath.startsWith(base + sep)) return new NextResponse("Não encontrado", { status: 404 });
  try {
    const file = await readFile(filePath);
    const extension = name.split(".").pop() ?? "";
    return new NextResponse(file, {
      headers: {
        "Content-Type": imageUploadContentTypes[extension],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Não encontrado", { status: 404 });
  }
}
