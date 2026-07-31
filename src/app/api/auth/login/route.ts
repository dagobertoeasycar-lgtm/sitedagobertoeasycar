import { NextRequest, NextResponse } from "next/server";
import { createSession, sessionCookie, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";

type UserRow = { id: string; password_hash: string; password_salt: string; active: boolean };
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const result = await query<UserRow>("select id, password_hash, password_salt, active from users where email=$1 limit 1", [email]);
  const user = result.rows[0];
  if (!user?.active || !verifyPassword(password, user.password_salt, user.password_hash)) return NextResponse.redirect(new URL("/admin/login?erro=1", request.url), 303);
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(sessionCookie.name, createSession(user.id), sessionCookie.options);
  await query("insert into audit_log(actor_id, action, entity_type) values ($1, 'login', 'session')", [user.id]);
  return response;
}
