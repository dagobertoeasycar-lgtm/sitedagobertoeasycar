import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";

const SETTING_KEY = "banner_interval_seconds";
const DEFAULT_INTERVAL_SECONDS = 5;
const MIN_INTERVAL_SECONDS = 1;
const MAX_INTERVAL_SECONDS = 300;

type SettingRow = { value: string };

function normalizeInterval(value: unknown) {
  const interval = Number(value);
  if (!Number.isInteger(interval) || interval < MIN_INTERVAL_SECONDS || interval > MAX_INTERVAL_SECONDS) return null;
  return interval;
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const result = await query<SettingRow>("SELECT value FROM site_settings WHERE key=$1 LIMIT 1", [SETTING_KEY]);
  const intervalSeconds = normalizeInterval(result.rows[0]?.value) ?? DEFAULT_INTERVAL_SECONDS;
  return NextResponse.json({ intervalSeconds });
}

export async function PUT(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json()) as { intervalSeconds?: unknown };
  const intervalSeconds = normalizeInterval(body.intervalSeconds);
  if (intervalSeconds === null) {
    return NextResponse.json({ error: "Informe um tempo inteiro entre 1 e 300 segundos" }, { status: 400 });
  }

  await query(
    `INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,now())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [SETTING_KEY, String(intervalSeconds)],
  );

  return NextResponse.json({ intervalSeconds });
}
