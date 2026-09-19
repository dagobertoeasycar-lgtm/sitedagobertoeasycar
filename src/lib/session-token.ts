import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "dagoberto_session";
const LEGACY_SESSION_MINUTES = 8 * 60;
const DISABLED_SESSION_COOKIE_SECONDS = 365 * 24 * 60 * 60;

export type AuthSession = {
  userId: string;
  issuedAt: number;
  expiresAt: number | null;
  timeoutMinutes: number | null;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET precisa ter ao menos 32 caracteres");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSession(userId: string, timeoutMinutes: number | null = LEGACY_SESSION_MINUTES) {
  const issuedAt = Date.now();
  const expiresAt = timeoutMinutes === null ? null : issuedAt + Math.max(1, timeoutMinutes) * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt, expiresAt, timeoutMinutes })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function parseSession(value?: string): AuthSession | null {
  if (!value) return null;
  const [payload, provided] = value.split(".");
  if (!payload || !provided) return null;
  const expected = signature(payload);
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const raw = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AuthSession>;
    if (typeof raw.userId !== "string" || !raw.userId) return null;
    if (raw.expiresAt !== null && typeof raw.expiresAt !== "number") return null;
    if (typeof raw.expiresAt === "number" && raw.expiresAt <= Date.now()) return null;
    const timeoutMinutes = typeof raw.timeoutMinutes === "number"
      ? raw.timeoutMinutes
      : raw.expiresAt === null
        ? null
        : LEGACY_SESSION_MINUTES;
    const issuedAt = typeof raw.issuedAt === "number"
      ? raw.issuedAt
      : typeof raw.expiresAt === "number"
        ? raw.expiresAt - LEGACY_SESSION_MINUTES * 60 * 1000
        : Date.now();
    return { userId: raw.userId, issuedAt, expiresAt: raw.expiresAt ?? null, timeoutMinutes };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(timeoutMinutes: number | null) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: timeoutMinutes === null
      ? DISABLED_SESSION_COOKIE_SECONDS
      : Math.max(60, Math.round(timeoutMinutes * 60)),
  };
}

export const defaultSessionCookieOptions = sessionCookieOptions(LEGACY_SESSION_MINUTES);
