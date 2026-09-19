import { NextResponse } from "next/server";
import { createSession, currentSession, parseSession, sessionCookie, sessionCookieOptions } from "@/lib/auth";
import { defaultSessionTimeoutSettings, readSessionTimeoutSettings } from "@/lib/session-settings";

export async function POST() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });

  const settings = await readSessionTimeoutSettings().catch(() => defaultSessionTimeoutSettings);
  const timeoutMinutes = settings.enabled ? settings.minutes : null;
  const value = createSession(session.userId, timeoutMinutes);
  const refreshed = parseSession(value);
  const response = NextResponse.json({
    enabled: settings.enabled,
    minutes: settings.minutes,
    expiresAt: refreshed?.expiresAt ?? null,
  });
  response.cookies.set(sessionCookie.name, value, sessionCookieOptions(timeoutMinutes));
  return response;
}
