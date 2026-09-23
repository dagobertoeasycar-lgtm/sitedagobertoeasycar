import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/session-token";
import { deviceOf, isBot, sectionOf, sourceOf } from "@/lib/site-analytics";

export const runtime = "nodejs";

const EVENTS = new Set(["pageview", "whatsapp_click", "form_open"]);
const ID_RE = /^[0-9a-f-]{16,64}$/i;

function header(request: NextRequest, name: string) {
  const value = request.headers.get(name);
  if (!value) return null;
  try { return decodeURIComponent(value).slice(0, 80); } catch { return value.slice(0, 80); }
}

/**
 * Recebe o contador de visitas do site. Responde sempre 204 para não gerar
 * ruído no navegador; o que não for válido é simplesmente ignorado.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  const userAgent = request.headers.get("user-agent") ?? "";
  // Robôs e a própria equipe logada no painel não entram na contagem.
  if (isBot(userAgent) || request.cookies.get(SESSION_COOKIE_NAME)?.value) return done;
  if (Number(request.headers.get("content-length") ?? 0) > 4000) return done;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return done;
  const event = String(body.event ?? "");
  const visitorId = String(body.visitorId ?? "");
  const sessionId = String(body.sessionId ?? "");
  const path = String(body.path ?? "").slice(0, 300);
  if (!EVENTS.has(event) || !ID_RE.test(visitorId) || !ID_RE.test(sessionId) || !path.startsWith("/") || path.startsWith("/admin")) return done;

  const params = new URLSearchParams(String(body.search ?? "").slice(0, 1000));
  const referrer = String(body.referrer ?? "").slice(0, 500);
  let referrerHost: string | null = null;
  try { referrerHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "").slice(0, 120) : null; } catch {}
  const utmSource = params.get("utm_source")?.slice(0, 120) || null;
  const utmMedium = params.get("utm_medium")?.slice(0, 120) || null;
  const utmCampaign = params.get("utm_campaign")?.slice(0, 160) || null;
  const siteHost = request.nextUrl.hostname;
  const { section, vehicleSlug } = sectionOf(path);
  // Depois da primeira página, a sessão já tem origem: o resto é navegação interna.
  const source = body.landing !== true ? "interno" : sourceOf(referrer, siteHost, { source: utmSource ?? "", medium: utmMedium ?? "" }, params);
  const searchQuery = section === "estoque" ? params.get("q")?.trim().toLowerCase().slice(0, 80) || null : null;

  await query(
    `insert into site_events(event, visitor_id, session_id, is_new_visitor, path, section, vehicle_slug, search_query, referrer_host, source,
       utm_source, utm_medium, utm_campaign, city, region, country, device)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      event, visitorId, sessionId, body.isNew === true && event === "pageview", path, section, vehicleSlug, searchQuery,
      source === "interno" ? null : referrerHost, source, utmSource, utmMedium, utmCampaign,
      header(request, "x-vercel-ip-city"), header(request, "x-vercel-ip-country-region"), header(request, "x-vercel-ip-country"),
      deviceOf(userAgent),
    ],
  ).catch((error) => console.error("Falha ao registrar visita", error instanceof Error ? error.message : error));
  return done;
}
