"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Contador de visitas próprio do site (primeira parte, anônimo).
 * Gera um id aleatório de visitante no navegador; não usa IP nem dados pessoais.
 */
type SiteEvent = "pageview" | "whatsapp_click" | "form_open";

function storedId(storage: Storage, key: string) {
  try {
    const existing = storage.getItem(key);
    if (existing) return { id: existing, created: false };
    const id = crypto.randomUUID();
    storage.setItem(key, id);
    return { id, created: true };
  } catch {
    return { id: crypto.randomUUID(), created: true };
  }
}

let firstHit = true;

export function trackSiteEvent(event: SiteEvent) {
  if (typeof window === "undefined") return;
  const visitor = storedId(window.localStorage, "ad_vid");
  const session = storedId(window.sessionStorage, "ad_sid");
  const body = JSON.stringify({
    event,
    path: window.location.pathname,
    search: window.location.search,
    // Só a primeira página da sessão diz de onde a pessoa veio.
    referrer: firstHit ? document.referrer : "",
    landing: firstHit && event === "pageview",
    visitorId: visitor.id,
    sessionId: session.id,
    isNew: visitor.created,
  });
  if (event === "pageview") firstHit = false;
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {}
  fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
}

export function SiteAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const last = useRef("");

  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`;
    if (last.current === key) return;
    last.current = key;
    trackSiteEvent("pageview");
  }, [pathname, searchParams]);

  // Qualquer link de WhatsApp do site conta como clique de contato.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (anchor && /(^|\/\/)(wa\.me|api\.whatsapp\.com)\//.test(anchor.href)) trackSiteEvent("whatsapp_click");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
