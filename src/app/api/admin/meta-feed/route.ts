import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMetaFeedSnapshot, saveMetaFeedSettings } from "@/lib/meta-feed-data";
import type { MetaFeedSettings } from "@/lib/meta-feed";

export const dynamic = "force-dynamic";

async function authorized() {
  const session = await currentSession();
  return session;
}

async function responseData() {
  const snapshot = await getMetaFeedSnapshot();
  const validation = await query<{ generated_at: Date; exported: number; ignored: number; errors: number }>(
    "SELECT generated_at,exported,ignored,errors FROM meta_feed_validations ORDER BY id DESC LIMIT 1",
  );
  return {
    feedUrl: "https://www.dagobertoeasycar.com.br/feeds/meta-veiculos.csv",
    generatedAt: snapshot.generatedAt,
    lastModified: snapshot.lastModified,
    exported: snapshot.exported,
    ignored: snapshot.ignored,
    errors: snapshot.errors,
    issues: snapshot.issues,
    settings: snapshot.settings,
    lastValidation: validation.rows[0] ?? null,
  };
}

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(await responseData(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null) as Partial<MetaFeedSettings> | null;
  if (!body) return NextResponse.json({ error: "Configuração inválida" }, { status: 400 });
  await saveMetaFeedSettings(body);
  return NextResponse.json(await responseData(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const session = await authorized();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const snapshot = await getMetaFeedSnapshot();
  const invalidReport = snapshot.issues.filter(issue => !["not_published", "availability_excluded"].includes(issue.code));
  await query(
    "INSERT INTO meta_feed_validations(actor_id,generated_at,exported,ignored,errors,report) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
    [session.userId, snapshot.generatedAt, snapshot.exported, snapshot.ignored, snapshot.errors, JSON.stringify(invalidReport)],
  );
  return NextResponse.json({
    ok: snapshot.errors === 0,
    generatedAt: snapshot.generatedAt,
    exported: snapshot.exported,
    ignored: snapshot.ignored,
    errors: snapshot.errors,
    issues: snapshot.issues,
  }, { headers: { "Cache-Control": "no-store" } });
}

