import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { safeMailError, sendLeadNotification } from "@/lib/email";

const kinds = new Set(["contact", "financing", "sell_car"]);
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) return NextResponse.json({ error: "Solicitação muito grande" }, { status: 413 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const message = String(body?.message ?? "").trim();
  const kind = String(body?.kind ?? "");
  const emailIsValid = email === "" || (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (!kinds.has(kind) || name.length < 2 || name.length > 120 || phone.length < 8 || phone.length > 30 || !emailIsValid || message.length < 2 || message.length > 2000 || body?.consent !== "yes") return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const inserted = await query<{ id: string }>("insert into leads(kind, name, email, phone, message, consent_at) values ($1,$2,$3,$4,$5,now()) returning id", [kind, name, email || null, phone, message]);
  try {
    await sendLeadNotification({ id: inserted.rows[0].id, kind: kind as "contact" | "financing" | "sell_car", name, email, phone, message });
  } catch (error) {
    console.error("Falha ao notificar novo lead por SMTP", safeMailError(error));
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
