"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, HandCoins, MessageCircle, X } from "lucide-react";
import { fireAdsConversion } from "@/lib/ads-conversions";
import { useMetaPixel } from "@/components/MetaPixelProvider";
import { trackSiteEvent } from "@/components/SiteAnalytics";

export type VehicleIntent = "simulacao" | "interesse" | "visita";

type VehicleSummary = { id: string; title: string; version: string; price: string; image: string; code: string };

const INTENTS: Record<VehicleIntent, { title: string; lead: string; button: string }> = {
  simulacao: { title: "Simule seu financiamento", lead: "Preencha os dados e um consultor envia as condições das financeiras parceiras.", button: "Enviar simulação" },
  interesse: { title: "Tenho interesse neste carro", lead: "Conte como pretende pagar e se tem carro na troca. Retornamos rapidinho.", button: "Enviar interesse" },
  visita: { title: "Agendar visita", lead: "Escolha o melhor dia e período. Confirmamos o horário com você.", button: "Solicitar agendamento" },
};

function moneyMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function phoneMask(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function today() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function Modal({ intent, vehicle, onClose }: { intent: VehicleIntent; vehicle: VehicleSummary; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [protocol, setProtocol] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [payment, setPayment] = useState(intent === "simulacao" ? "Financiamento" : "");
  const [trade, setTrade] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const { track } = useMetaPixel();
  const copy = INTENTS[intent];

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const url = new URL(window.location.href);
    const payload = {
      ...data,
      kind: intent === "simulacao" ? "financing" : "vehicle_interest",
      intent,
      vehicleId: vehicle.id,
      pageUrl: url.href,
      leadSource: "site",
      utmSource: url.searchParams.get("utm_source") || "",
      utmMedium: url.searchParams.get("utm_medium") || "",
      utmCampaign: url.searchParams.get("utm_campaign") || "",
    };
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as { error?: string; protocol?: string; confirmationEmail?: boolean };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar agora.");
      setProtocol(result.protocol || "");
      setSentTo(result.confirmationEmail ? data.email || "" : "");
      setState("done");
      track("Lead", { lead_type: payload.kind, intent, content_ids: [vehicle.code] });
      fireAdsConversion("lead", { lead_type: payload.kind });
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Não foi possível enviar agora. Tente novamente.");
    }
  }

  return (
    <div className="vlead-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="vlead-dialog" role="dialog" aria-modal="true" aria-labelledby="vlead-title" ref={dialog}>
        <button type="button" className="vlead-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        <div className="vlead-vehicle">
          {vehicle.image && <img src={vehicle.image} alt="" />}
          <div>
            <small>Veículo de interesse</small>
            <strong>{vehicle.title}</strong>
            <span>{vehicle.version}</span>
            <b>{vehicle.price}</b>
          </div>
        </div>

        {state === "done" ? (
          <div className="vlead-done">
            <CheckCircle2 size={52} aria-hidden="true" />
            <h2>Solicitação enviada!</h2>
            {protocol && <p className="vlead-protocol">Protocolo <b>{protocol}</b></p>}
            <p>Um consultor da Autodrive vai falar com você em breve.{sentTo && <> A confirmação vai chegar em <b>{sentTo}</b>.</>}</p>
            <div className="vlead-done-actions">
              <a className="button" href={`https://wa.me/5511934718276?text=${encodeURIComponent(`Olá! Acabei de enviar uma solicitação pelo site sobre o ${vehicle.title} (protocolo ${protocol}).`)}`} target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" />Adiantar pelo WhatsApp</a>
              <button type="button" className="button button-outline" onClick={onClose}>Fechar</button>
            </div>
          </div>
        ) : (
          <form className="vlead-form" onSubmit={submit}>
            <h2 id="vlead-title">{copy.title}</h2>
            <p className="vlead-lead">{copy.lead}</p>

            <fieldset>
              <legend>Seus dados</legend>
              <label className="vlead-full">Nome completo *<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
              <label>WhatsApp *<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" maxLength={16} onInput={(e) => { e.currentTarget.value = phoneMask(e.currentTarget.value); }} /></label>
              <label>E-mail *<input name="email" type="email" required maxLength={160} autoComplete="email" /></label>
            </fieldset>

            <fieldset>
              <legend>Forma de pagamento</legend>
              <div className="vlead-chips" role="radiogroup" aria-label="Forma de pagamento">
                {["À vista", "Financiamento", "Consórcio", "Ainda não sei"].map((option) => (
                  <label key={option} className={payment === option ? "active" : ""}>
                    <input type="radio" name="paymentMethod" value={option} required checked={payment === option} onChange={() => setPayment(option)} />{option}
                  </label>
                ))}
              </div>
              {payment === "Financiamento" && (
                <>
                  <label>Valor de entrada<input name="downPayment" inputMode="numeric" placeholder="R$ 0,00" onInput={(e) => { e.currentTarget.value = moneyMask(e.currentTarget.value); }} /></label>
                  <label>Prazo desejado
                    <select name="installments" defaultValue="48x">
                      {["12x", "24x", "36x", "48x", "60x"].map((n) => <option key={n}>{n}</option>)}
                    </select>
                  </label>
                </>
              )}
            </fieldset>

            <fieldset>
              <legend>Tem carro na troca?</legend>
              <div className="vlead-chips" role="radiogroup" aria-label="Carro na troca">
                {["Sim", "Não"].map((option) => (
                  <label key={option} className={trade === option ? "active" : ""}>
                    <input type="radio" name="hasTrade" value={option} required checked={trade === option} onChange={() => setTrade(option)} />{option}
                  </label>
                ))}
              </div>
              {trade === "Sim" && (
                <>
                  <label className="vlead-full">Marca e modelo *<input name="tradeVehicle" required maxLength={120} placeholder="Ex.: VW Gol 1.0" /></label>
                  <label>Ano<input name="tradeYear" inputMode="numeric" maxLength={9} placeholder="2019/2020" /></label>
                  <label>Quilometragem<input name="tradeMileage" inputMode="numeric" maxLength={9} placeholder="Ex.: 65000" /></label>
                </>
              )}
            </fieldset>

            {intent === "visita" && (
              <fieldset>
                <legend>Melhor dia para a visita</legend>
                <label>Data *<input name="visitDate" type="date" required min={today()} /></label>
                <label>Período
                  <select name="visitPeriod" defaultValue="Manhã"><option>Manhã</option><option>Tarde</option><option>Sábado</option></select>
                </label>
              </fieldset>
            )}

            <label className="vlead-full">Observações<textarea name="message" rows={3} maxLength={1500} placeholder="Dúvidas, melhor horário para contato, opcionais que procura..." /></label>
            <label className="consent vlead-full"><input name="consent" type="checkbox" value="yes" required /> Autorizo o contato da Autodrive sobre esta solicitação e li a <a href="/privacidade" target="_blank">Política de Privacidade</a>.</label>
            <button className="button vlead-submit" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : copy.button}</button>
            {state === "error" && <p className="form-status error" role="alert">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function IntentButton({ intent, vehicle, className, children }: { intent: VehicleIntent; vehicle: VehicleSummary; className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { track } = useMetaPixel();
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setOpen(true);
          trackSiteEvent("form_open");
          if (intent === "simulacao") track("InitiateVehicleFinancing", { content_ids: [vehicle.code] }, true);
        }}
      >
        {children}
      </button>
      {open && <Modal intent={intent} vehicle={vehicle} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Botões da lateral do anúncio: cada um abre o formulário já com o carro. */
export function VehicleLeadActions({ vehicle, whatsappHref, phoneLabel, storeInfo }: { vehicle: VehicleSummary; whatsappHref: string; phoneLabel: string; storeInfo: ReactNode }) {
  return (
    <>
      <IntentButton intent="simulacao" vehicle={vehicle} className="button detail-sim-btn"><HandCoins size={18} aria-hidden="true" />Faça sua Simulação Online</IntentButton>
      <div className="detail-contact-card">
        <a href={whatsappHref} className="detail-contact-item" target="_blank" rel="noreferrer">
          <span className="detail-contact-icon"><MessageCircle size={18} aria-hidden="true" /></span>
          <span>{phoneLabel}</span>
        </a>
        {storeInfo}
        <IntentButton intent="interesse" vehicle={vehicle} className="button">Tenho interesse</IntentButton>
        <IntentButton intent="visita" vehicle={vehicle} className="button button-outline"><CalendarDays size={17} aria-hidden="true" />Agendar visita</IntentButton>
      </div>
    </>
  );
}
