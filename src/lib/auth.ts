import { scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  defaultSessionCookieOptions,
  parseSession,
  SESSION_COOKIE_NAME,
} from "@/lib/session-token";

export { createSession, parseSession, sessionCookieOptions, type AuthSession } from "@/lib/session-token";

export function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export function verifyPassword(password: string, salt: string, expected: string) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const target = Buffer.from(expected, "hex");
  return actual.length === target.length && timingSafeEqual(actual, target);
}

export async function currentSession() {
  return parseSession((await cookies()).get(SESSION_COOKIE_NAME)?.value);
}

export const sessionCookie = {
  name: SESSION_COOKIE_NAME,
  options: defaultSessionCookieOptions,
};
