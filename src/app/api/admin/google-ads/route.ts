import { NextRequest, NextResponse } from "next/server";
import { apiArea } from "@/lib/permissions";
import { getAdsConversions, saveAdsConversions } from "@/lib/settings";
import { isValidConversionLabel } from "@/lib/ads-conversions";
import { audit } from "@/lib/audit";

export async function GET() {
  const guard = await apiArea("configuracoes");
  if (guard.error) return guard.error;
  return NextResponse.json(await getAdsConversions());
}

export async function POST(request: NextRequest) {
  const guard = await apiArea("configuracoes");
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => null) as { lead?: string; whatsapp?: string } | null;
  for (const [campo, valor] of Object.entries(body ?? {})) {
    const texto = String(valor ?? "").trim();
    if (texto && !isValidConversionLabel(texto)) {
      return NextResponse.json({ error: `Rótulo inválido em "${campo}". Use o formato AW-123456789/AbCdEfG.` }, { status: 400 });
    }
  }
  const saved = await saveAdsConversions(body);
  await audit(guard.user.id, "update", "settings", "google_ads_conversions", { saved }, request);
  return NextResponse.json(saved);
}
