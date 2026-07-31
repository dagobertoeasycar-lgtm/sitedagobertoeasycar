import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { currentSession, hashPassword, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";

type UserPassword = { password_hash: string; password_salt: string };

function strongPassword(value: string) {
  return value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export async function POST(request: NextRequest) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { currentPassword?: string; newPassword?: string; confirmation?: string } | null;
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  if (newPassword !== String(body?.confirmation ?? "")) return NextResponse.json({ error: "A confirmação não confere" }, { status: 400 });
  if (!strongPassword(newPassword)) return NextResponse.json({ error: "A nova senha não atende aos requisitos" }, { status: 400 });
  const result = await query<UserPassword>("select password_hash,password_salt from users where id=$1 and active limit 1", [session.userId]);
  const user = result.rows[0];
  if (!user || !verifyPassword(currentPassword, user.password_salt, user.password_hash)) return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(newPassword, salt);
  await query(`
    with changed as (
      update users
      set password_hash=$1, password_salt=$2, must_change_password=false, updated_at=now()
      where id=$3
      returning id
    )
    insert into audit_log(actor_id, action, entity_type, entity_id)
    select id, 'change_password', 'user', id::text from changed
  `, [passwordHash, salt, session.userId]);
  return NextResponse.json({ ok: true });
}
