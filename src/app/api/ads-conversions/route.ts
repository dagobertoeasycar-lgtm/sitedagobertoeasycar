import { NextResponse } from "next/server";
import { getAdsConversions } from "@/lib/settings";
import { EMPTY_ADS_CONVERSIONS } from "@/lib/ads-conversions";

export const dynamic = "force-dynamic";

/**
 * Rótulos de conversão para o navegador. Público de propósito: o rótulo já
 * aparece no código de qualquer site que use a tag do Google, e assim as
 * páginas estáticas continuam estáticas.
 */
export async function GET() {
  const conversions = await getAdsConversions().catch(() => EMPTY_ADS_CONVERSIONS);
  return NextResponse.json(conversions, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
