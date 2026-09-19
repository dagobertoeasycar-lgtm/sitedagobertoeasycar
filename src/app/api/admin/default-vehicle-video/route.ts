import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { isVercelBlobUrl } from "@/lib/media-upload";

const SETTING_KEY = "default_vehicle_video_url";

export async function GET() {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const result = await query<{ value: string }>("SELECT value FROM site_settings WHERE key=$1 LIMIT 1", [SETTING_KEY]);
  return NextResponse.json({ url: result.rows[0]?.value || "" });
}

export async function PUT(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = (await request.json()) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url && !isVercelBlobUrl(url, "vehicle-videos")) {
    return NextResponse.json({ error: "Vídeo inválido" }, { status: 400 });
  }
  await query(
    `INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,now())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [SETTING_KEY, url],
  );
  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'video_padrao','site_setting',$2,$3::jsonb)",
    [session.userId, SETTING_KEY, JSON.stringify({ url })],
  ).catch(() => undefined);
  return NextResponse.json({ url });
}
