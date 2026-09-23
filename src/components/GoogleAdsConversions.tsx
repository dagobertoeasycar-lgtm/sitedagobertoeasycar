"use client";

import { useEffect } from "react";
import { fireAdsConversion, type AdsConversions } from "@/lib/ads-conversions";

/**
 * Entrega os rótulos de conversão ao navegador e conta como conversão todo
 * clique em link de WhatsApp ou telefone, em qualquer página do site.
 */
export function GoogleAdsConversions({ conversions }: { conversions: AdsConversions }) {
  useEffect(() => {
    window.__autodriveAds = conversions;
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href") ?? "";
      if (/wa\.me|api\.whatsapp\.com|^tel:/i.test(href)) fireAdsConversion("whatsapp", { canal: href.startsWith("tel:") ? "telefone" : "whatsapp" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [conversions]);

  return null;
}
