import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

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
  if (!kinds.has(kind) || name.length < 2 || name.length > 120 || phone.length < 8 || phone.length > 30 || message.length < 2 || message.length > 2000 || body?.consent !== "yes") return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  await query("insert into leads(kind, name, email, phone, message, consent_at) values ($1,$2,$3,$4,$5,now())", [kind, name, email || null, phone, message]);
  return NextResponse.json({ ok: true }, { status: 201 });
}
