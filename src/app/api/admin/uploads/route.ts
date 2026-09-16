import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { imageUploadMaxBytes, saveImageFile } from "@/lib/image-upload";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > imageUploadMaxBytes) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  try {
    const uploaded = await saveImageFile(file);
    return NextResponse.json({ url: uploaded.url }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload inválido";
    return NextResponse.json({ error: message }, { status: message === "Formato não permitido" ? 415 : 400 });
  }
}
