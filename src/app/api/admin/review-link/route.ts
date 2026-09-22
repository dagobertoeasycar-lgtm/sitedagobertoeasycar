import { NextRequest, NextResponse } from "next/server";
import { apiArea } from "@/lib/permissions";
import { getReviewLink, saveReviewLink } from "@/lib/settings";
import { audit } from "@/lib/audit";

export async function GET() {
  const guard = await apiArea("configuracoes");
  if (guard.error) return guard.error;
  return NextResponse.json({ url: await getReviewLink() });
}

export async function POST(request: NextRequest) {
  const guard = await apiArea("configuracoes");
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => null) as { url?: string } | null;
  try {
    const url = await saveReviewLink(String(body?.url ?? ""));
    await audit(guard.user.id, "update", "settings", "google_review_link", { url }, request);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Link inválido." }, { status: 400 });
  }
}
