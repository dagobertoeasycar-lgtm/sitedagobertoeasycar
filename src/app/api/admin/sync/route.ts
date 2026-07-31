import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { exec } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

type SyncRun = {
  id: string;
  source_id: string;
  started_at: Date;
  finished_at: Date | null;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

type SyncConfig = { key: string; value: string };

// GET - status da última sincronização
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [lastRun, config] = await Promise.all([
    query<SyncRun>(
      "select * from sync_runs where source_id='easycar_scraper' order by started_at desc limit 5"
    ),
    query<SyncConfig>("select key, value from sync_config"),
  ]);

  const configMap: Record<string, string> = {};
  config.rows.forEach((r) => (configMap[r.key] = r.value));

  return NextResponse.json({
    enabled: configMap.easycar_enabled !== "false",
    intervalMinutes: parseInt(configMap.easycar_interval_minutes || "5"),
    lastRuns: lastRun.rows,
    running: lastRun.rows[0]?.finished_at === null,
  });
}

// POST - ações: sync manual, toggle, alterar intervalo
export async function POST(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json()) as { action: string; value?: string };

  if (body.action === "toggle") {
    const current = await query<SyncConfig>(
      "select value from sync_config where key='easycar_enabled'"
    );
    const newVal = current.rows[0]?.value === "true" ? "false" : "true";
    await query(
      "insert into sync_config(key,value,updated_at) values('easycar_enabled',$1,now()) on conflict(key) do update set value=$1, updated_at=now()",
      [newVal]
    );
    return NextResponse.json({ enabled: newVal === "true" });
  }

  if (body.action === "interval" && body.value) {
    const minutes = Math.max(1, Math.min(60, parseInt(body.value) || 5));
    await query(
      "insert into sync_config(key,value,updated_at) values('easycar_interval_minutes',$1,now()) on conflict(key) do update set value=$1, updated_at=now()",
      [String(minutes)]
    );
    return NextResponse.json({ intervalMinutes: minutes });
  }

  if (body.action === "sync") {
    const running = await query<SyncRun>(
      "select id from sync_runs where source_id='easycar_scraper' and finished_at is null and started_at > now() - interval '10 minutes' limit 1"
    );
    if (running.rows.length > 0) {
      return NextResponse.json({ error: "Sincronização já em andamento" }, { status: 409 });
    }

    const scriptPath = path.join(process.cwd(), "scripts", "sync-easycar.mjs");
    exec(`node "${scriptPath}"`, {
      env: { ...process.env },
      timeout: 600_000,
    }, (err, _stdout, stderr) => {
      if (err) console.error("Sync error:", stderr);
    });

    return NextResponse.json({ started: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
