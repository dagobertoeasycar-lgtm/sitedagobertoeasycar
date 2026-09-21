import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { saveImageFile } from "@/lib/image-upload";
import { adminImageMaxBytes } from "@/lib/media-upload";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido ou muito grande." }, { status: 413 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (file.size > adminImageMaxBytes) {
    return NextResponse.json(
      { error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). O limite é ${Math.round(adminImageMaxBytes / 1024 / 1024)} MB.` },
      { status: 413 },
    );
  }

  try {
    const uploaded = await saveImageFile(file, adminImageMaxBytes);
    return NextResponse.json({ url: uploaded.url }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload inválido";
    const status = message.includes("Formato não permitido") || message.includes("Vídeos não são aceitos") ? 415 : message.includes("não está conectado") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

