import { NextRequest, NextResponse } from "next/server";
import { createSession, parseSession, sessionCookie, sessionCookieOptions } from "@/lib/auth";
import { sessionFor } from "@/lib/permissions";
import { query } from "@/lib/db";
import {
  MAX_SESSION_TIMEOUT_MINUTES,
  MIN_SESSION_TIMEOUT_MINUTES,
  readSessionTimeoutSettings,
  writeSessionTimeoutSettings,
} from "@/lib/session-settings";

export async function GET() {
  const session = await sessionFor("configuracoes");
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const settings = await readSessionTimeoutSettings();
  return NextResponse.json({ ...settings, expiresAt: session.expiresAt });
}

export async function PUT(request: NextRequest) {
  const session = await sessionFor("configuracoes");
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = (await request.json()) as { enabled?: unknown; minutes?: unknown };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Informe se o encerramento automático deve ficar ativo." }, { status: 400 });
  }
  const minutes = Number(body.minutes);
  if (!Number.isInteger(minutes) || minutes < MIN_SESSION_TIMEOUT_MINUTES || minutes > MAX_SESSION_TIMEOUT_MINUTES) {
    return NextResponse.json(
      { error: `Escolha um tempo entre ${MIN_SESSION_TIMEOUT_MINUTES} e ${MAX_SESSION_TIMEOUT_MINUTES} minutos.` },
      { status: 400 },
    );
  }

  const settings = await writeSessionTimeoutSettings({ enabled: body.enabled, minutes });
  const timeoutMinutes = settings.enabled ? settings.minutes : null;
  const value = createSession(session.userId, timeoutMinutes);
  const refreshed = parseSession(value);
  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'session_timeout','site_setting',$2,$3::jsonb)",
    [session.userId, "admin_session_timeout", JSON.stringify(settings)],
  ).catch(() => undefined);

  const response = NextResponse.json({ ...settings, expiresAt: refreshed?.expiresAt ?? null });
  response.cookies.set(sessionCookie.name, value, sessionCookieOptions(timeoutMinutes));
  return response;
}
