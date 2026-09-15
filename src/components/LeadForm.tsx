"use client";

import { useState, type FormEvent } from "react";
import { useMetaPixel } from "@/components/MetaPixelProvider";

export function LeadForm({ kind, title }: { kind: "contact" | "financing" | "sell_car"; title: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const { track } = useMetaPixel();

  function trackingPayload() {
    const url = new URL(window.location.href);
    return {
      pageUrl: url.href,
      leadSource: "site",
      campaign: url.searchParams.get("utm_campaign") || "",
      utmSource: url.searchParams.get("utm_source") || "",
      utmMedium: url.searchParams.get("utm_medium") || "",
      utmCampaign: url.searchParams.get("utm_campaign") || "",
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    if (kind === "financing") track("InitiateVehicleFinancing", { lead_type: kind }, true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, kind, ...trackingPayload() }) });
    setState(response.ok ? "done" : "error");
    if (response.ok) {
      track("Lead", { lead_type: kind });
      formEl.reset();
    }
  }
  return (
    <form className="lead-form" onSubmit={submit}>
      <h2>{title}</h2>
      <label>Nome<input name="name" required maxLength={120} autoComplete="name" /></label>
      <div className="form-row">
        <label>Telefone<input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" /></label>
        <label>E-mail<input name="email" type="email" maxLength={160} autoComplete="email" /></label>
      </div>
      <label>Mensagem<textarea name="message" required maxLength={2000} rows={5} /></label>
      <label className="consent"><input name="consent" type="checkbox" value="yes" required /> Autorizo o contato sobre esta solicitação e li a <a href="/privacidade">Política de Privacidade</a>.</label>
      <button className="button" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : "Enviar solicitação"}</button>
      <p className={`form-status ${state}`} aria-live="polite">{state === "done" ? "Recebemos sua solicitação. A equipe entrará em contato." : state === "error" ? "Não foi possível enviar agora. Tente novamente ou fale pelo WhatsApp." : ""}</p>
    </form>
  );
}
