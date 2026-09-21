import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  readDefaultVehicleVideo,
  setDefaultVehicleVideoEnabled,
  writeDefaultVehicleVideo,
} from "@/lib/default-vehicle-video";
import { isVercelBlobUrl } from "@/lib/media-upload";

type VideoStats = { published: number; custom: number };

async function responseState() {
  const [video, counts] = await Promise.all([
    readDefaultVehicleVideo(),
    query<VideoStats>(
      `SELECT
         count(*) FILTER (WHERE status='published')::int AS published,
         count(*) FILTER (
           WHERE status='published' AND NULLIF(btrim(video_url),'') IS NOT NULL
         )::int AS custom
       FROM vehicles`,
    ),
  ]);
  const published = counts.rows[0]?.published || 0;
  const custom = counts.rows[0]?.custom || 0;
  return {
    url: video.url,
    enabled: video.enabled,
    stats: {
      published,
      custom,
      inheriting: video.enabled ? Math.max(0, published - custom) : 0,
    },
  };
}

export async function GET() {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(await responseState());
}

export async function PUT(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = (await request.json()) as { url?: unknown; enabled?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (url && !isVercelBlobUrl(url, "vehicle-videos") && !/youtu\.be\/|youtube\.com\/|drive\.google\.com\//i.test(url)) {
    return NextResponse.json({ error: "Vídeo inválido" }, { status: 400 });
  }
  const enabled = Boolean(url) && (typeof body.enabled === "boolean" ? body.enabled : true);
  await writeDefaultVehicleVideo(url, enabled);
  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'video_padrao','site_setting',$2,$3::jsonb)",
    [session.userId, "default_vehicle_video", JSON.stringify({ url, enabled })],
  ).catch(() => undefined);
  return NextResponse.json(await responseState());
}

export async function PATCH(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = (await request.json()) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Informe se o vídeo deve ficar ativo ou pausado." }, { status: 400 });
  }
  const current = await readDefaultVehicleVideo();
  if (body.enabled && !current.url) {
    return NextResponse.json({ error: "Envie um vídeo padrão antes de ativar." }, { status: 409 });
  }
  await setDefaultVehicleVideoEnabled(body.enabled);
  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'video_padrao_status','site_setting',$2,$3::jsonb)",
    [session.userId, "default_vehicle_video", JSON.stringify({ enabled: body.enabled })],
  ).catch(() => undefined);
  return NextResponse.json(await responseState());
}
