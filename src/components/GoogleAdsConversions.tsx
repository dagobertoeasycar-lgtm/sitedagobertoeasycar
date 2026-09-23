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
    // Página estática pode ter sido gerada antes dos rótulos existirem, então
    // busca a versão atual sem tirar a página do cache.
    if (!conversions.lead && !conversions.whatsapp) {
      fetch("/api/ads-conversions")
        .then((response) => response.json())
        .then((data: AdsConversions) => { window.__autodriveAds = data; })
        .catch(() => undefined);
    }
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
