import { NextResponse } from "next/server";
import { databaseStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await databaseStatus();
    return NextResponse.json({ status: "ok", database: "ok", environment: process.env.NODE_ENV ?? "unknown", version: process.env.APP_VERSION ?? "unknown", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unavailable", environment: process.env.NODE_ENV ?? "unknown", version: process.env.APP_VERSION ?? "unknown", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
