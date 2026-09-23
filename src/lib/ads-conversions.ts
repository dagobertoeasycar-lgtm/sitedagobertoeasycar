/**
 * Conversões do Google Ads. Os rótulos (AW-XXXX/YYYY) ficam em app_settings
 * para poderem mudar sem publicar o site, e são entregues ao navegador pelo
 * componente GoogleAdsConversions.
 */
export type AdsConversions = { lead: string; whatsapp: string };

export const EMPTY_ADS_CONVERSIONS: AdsConversions = { lead: "", whatsapp: "" };

/** Formato aceito: AW-123456789/AbCdEfG. */
export function isValidConversionLabel(value: string) {
  return /^(AW|G|GT|DC)-[A-Za-z0-9-]+\/[A-Za-z0-9_-]+$/.test(value.trim());
}

export function normalizeAdsConversions(raw: unknown): AdsConversions {
  const data = (raw ?? {}) as Partial<Record<keyof AdsConversions, unknown>>;
  const pick = (value: unknown) => {
    const text = String(value ?? "").trim();
    return isValidConversionLabel(text) ? text : "";
  };
  return { lead: pick(data.lead), whatsapp: pick(data.whatsapp) };
}

declare global {
  interface Window {
    __autodriveAds?: AdsConversions;
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara a conversão no Google Ads. Silencioso quando o rótulo não está
 * configurado ou a tag ainda não carregou — nunca atrapalha o envio do lead.
 */
export function fireAdsConversion(kind: keyof AdsConversions, extra: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const label = window.__autodriveAds?.[kind];
  if (!label || typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", { send_to: label, ...extra });
}
