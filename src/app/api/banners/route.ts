import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await query("SELECT * FROM banners WHERE active = true ORDER BY sort_order ASC, id ASC");
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
