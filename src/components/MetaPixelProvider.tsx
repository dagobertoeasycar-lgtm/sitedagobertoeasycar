"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { isValidMetaPixelId, sanitizeMetaPixelParameters, type MetaPixelParameters } from "@/lib/meta-pixel";

type ConsentState = "unknown" | "accepted" | "rejected";
type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

type MetaPixelContextValue = {
  consent: ConsentState;
  enabled: boolean;
  track: (eventName: string, parameters?: MetaPixelParameters, custom?: boolean) => void;
};

const MetaPixelContext = createContext<MetaPixelContextValue>({
  consent: "unknown",
  enabled: false,
  track: () => undefined,
});

const CONSENT_COOKIE = "dagoberto_analytics_consent";
const initializedPixels = new Set<string>();
const pendingEvents: Array<{ eventName: string; parameters: MetaPixelParameters; custom: boolean }> = [];
const recentEvents = new Map<string, number>();
let lastPageViewPath = "";

function readConsent(): ConsentState {
  if (typeof document === "undefined") return "unknown";
  const value = document.cookie.split(";").map(item => item.trim()).find(item => item.startsWith(`${CONSENT_COOKIE}=`))?.split("=")[1];
  return value === "accepted" || value === "rejected" ? value : "unknown";
}

function writeConsent(value: Exclude<ConsentState, "unknown">) {
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
}

function hasConsent(): boolean {
  return readConsent() === "accepted";
}

function dispatchEvent(eventName: string, parameters: MetaPixelParameters, custom: boolean) {
  if (!window.fbq) return;
  window.fbq(custom ? "trackCustom" : "track", eventName, parameters);
}

function trackEvent(eventName: string, parameters: MetaPixelParameters = {}, custom = false) {
  if (typeof window === "undefined" || !hasConsent()) return;
  const sanitized = sanitizeMetaPixelParameters(parameters);
  const signature = `${custom ? "custom" : "standard"}:${eventName}:${JSON.stringify(sanitized)}`;
  const now = Date.now();
  if (now - (recentEvents.get(signature) ?? 0) < 1000) return;
  recentEvents.set(signature, now);
  if (window.fbq) dispatchEvent(eventName, sanitized, custom);
  else pendingEvents.push({ eventName, parameters: sanitized, custom });
}

function initializePixel(pixelId: string) {
  if (!window.fbq) {
    const fbq: FbqFunction = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.metaPixel = "true";
    document.head.appendChild(script);
  }
  const fbq = window.fbq;
  if (!fbq) return;
  fbq("consent", "grant");
  if (!initializedPixels.has(pixelId)) {
    fbq("init", pixelId);
    initializedPixels.add(pixelId);
  }
  while (pendingEvents.length) {
    const event = pendingEvents.shift();
    if (event) dispatchEvent(event.eventName, event.parameters, event.custom);
  }
}

export function useMetaPixel() {
  return useContext(MetaPixelContext);
}

export function MetaPixelProvider({ pixelId, children }: { pixelId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = isValidMetaPixelId(pixelId);
  const [consent, setConsent] = useState<ConsentState>("unknown");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setConsent(readConsent()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!enabled || consent !== "accepted") return;
    initializePixel(pixelId);
    if (lastPageViewPath !== pathname) {
      window.fbq?.("track", "PageView");
      lastPageViewPath = pathname;
    }
  }, [consent, enabled, pathname, pixelId]);

  const track = useCallback((eventName: string, parameters: MetaPixelParameters = {}, custom = false) => {
    if (!enabled || consent !== "accepted") return;
    initializePixel(pixelId);
    trackEvent(eventName, parameters, custom);
  }, [consent, enabled, pixelId]);

  const choose = (value: Exclude<ConsentState, "unknown">) => {
    writeConsent(value);
    setConsent(value);
    setSettingsOpen(false);
    if (value === "rejected") {
      window.fbq?.("consent", "revoke");
      lastPageViewPath = "";
    }
  };

  const context = useMemo(() => ({ consent, enabled, track }), [consent, enabled, track]);
  const showPanel = enabled && (consent === "unknown" || settingsOpen);

  return (
    <MetaPixelContext.Provider value={context}>
      {children}
      {showPanel && (
        <section className="cookie-consent" role="dialog" aria-label="Preferências de cookies" aria-live="polite">
          <div>
            <strong>Privacidade e cookies</strong>
            <p>Com sua autorização, usamos o Meta Pixel para medir visitas e interações. Não enviamos CPF, telefone ou e-mail nos eventos.</p>
          </div>
          <div className="cookie-consent-actions">
            <button type="button" className="button button-outline" onClick={() => choose("rejected")}>Recusar</button>
            <button type="button" className="button" onClick={() => choose("accepted")}>Aceitar</button>
          </div>
        </section>
      )}
      {enabled && consent !== "unknown" && !settingsOpen && (
        <button type="button" className="cookie-settings" onClick={() => setSettingsOpen(true)}>Cookies</button>
      )}
    </MetaPixelContext.Provider>
  );
}
