import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";

const key = "home_testimonials";

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 6).map(item => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return {
      name: String(row.name ?? "").trim().slice(0, 80),
      text: String(row.text ?? "").trim().slice(0, 360),
      vehicle: String(row.vehicle ?? "").trim().slice(0, 100),
    };
  }).filter(item => item.name.length >= 2 && item.text.length >= 8);
}

export async function GET() {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const result = await query<{ value: string }>("SELECT value FROM site_settings WHERE key=$1 LIMIT 1", [key]);
  try { return NextResponse.json(cleanList(JSON.parse(result.rows[0]?.value || "[]")) || []); } catch { return NextResponse.json([]); }
}

export async function PUT(request: NextRequest) {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null) as { testimonials?: unknown } | null;
  const testimonials = cleanList(body?.testimonials);
  if (!testimonials) return NextResponse.json({ error: "Lista de depoimentos inválida" }, { status: 400 });
  await query(`INSERT INTO site_settings(key,value,updated_at) VALUES($1,$2,now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, [key, JSON.stringify(testimonials)]);
  return NextResponse.json(testimonials);
}
