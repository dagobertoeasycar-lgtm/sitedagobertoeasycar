"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMetaPixel } from "@/components/MetaPixelProvider";
import type { VehicleChoice } from "@/lib/vehicles";
import { VehicleImage } from "@/components/VehicleImage";
import { FINANCING_SERVICES, type FinancingService } from "@/lib/financing";

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function FinancingForm({ vehicles, service = "partners" }: { vehicles: VehicleChoice[]; service?: FinancingService }) {
  const config = FINANCING_SERVICES[service];
  const target = config.target;
  const eligibleVehicles = useMemo(() => service === "partners" ? vehicles.filter(vehicle => vehicle.origin_type === "PARTNER") : [], [vehicles, service]);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState(eligibleVehicles[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");
  const { track } = useMetaPixel();

  const selectedVehicle = eligibleVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const filteredVehicles = useMemo(() => {
    const search = normalized(vehicleQuery.trim());
    const list = search
      ? eligibleVehicles.filter((vehicle) => normalized(`${vehicle.title} ${vehicle.brand} ${vehicle.model} ${vehicle.version} ${vehicle.catalog_item_id}`).includes(search))
      : eligibleVehicles;
    return list.slice(0, 8);
  }, [vehicleQuery, eligibleVehicles]);

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
    setMessage("");

    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const desiredVehicle = String(form.get("desiredVehicle") ?? "").trim();
    const notes = String(form.get("message") ?? "").trim();

    if (target === "site" && !selectedVehicle) {
      setState("error");
      setMessage("Escolha um veículo de parceiro para continuar.");
      return;
    }
    if (target === "network" && desiredVehicle.length < 2) {
      setState("error");
      setMessage("Informe qual veículo você quer financiar.");
      return;
    }

    const vehicleLabel = selectedVehicle
      ? `${selectedVehicle.title} (${selectedVehicle.catalog_item_id})`
      : desiredVehicle;

    track("InitiateVehicleFinancing", { lead_type: "financing", financing_target: target, financing_service: service }, true);
    const payload = {
      ...Object.fromEntries(form.entries()),
      kind: "financing",
      financingTarget: target,
      financingService: service,
      vehicleId: selectedVehicle?.id ?? "",
      vehicleTitle: vehicleLabel,
      selectedVehicleLabel: vehicleLabel,
      vehicleOriginType: selectedVehicle?.origin_type ?? "PRIVATE",
      message: notes,
      ...trackingPayload(),
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        track("Lead", { lead_type: "financing", financing_target: target, financing_service: service });
        window.location.assign(config.successHref);
        return;
      }
      const result = await response.json().catch(() => null);
      setMessage(typeof result?.error === "string" ? result.error : "Não foi possível enviar agora. Tente novamente ou fale pelo WhatsApp.");
    } catch {
      setMessage("Não foi possível conectar. Confira sua conexão e tente novamente ou fale pelo WhatsApp.");
    }
    setState("error");
  }

  return (
    <form className="lead-form finance-form" onSubmit={submit}>
      <h2>{service === "partners" ? "Simular financiamento" : "Solicitar Financia Fácil"}</h2>
      <p className="form-help">{config.originLabel}</p>

      {target === "site" ? (
        <div className="finance-vehicle-picker">
          <label>Buscar veículo de parceiro
            <input value={vehicleQuery} onChange={(event) => setVehicleQuery(event.currentTarget.value)} placeholder="Ex.: Corolla, Compass, automático" />
          </label>
          <input type="hidden" name="vehicleId" value={selectedVehicle?.id ?? ""} />
          <input type="hidden" name="vehicleTitle" value={selectedVehicle ? `${selectedVehicle.title} (${selectedVehicle.catalog_item_id})` : ""} />
          {selectedVehicle && <p className="finance-selected"><strong>Selecionado:</strong> {selectedVehicle.title}</p>}
          <div className="finance-vehicle-list" role="group" aria-label="Veículos encontrados">
            {filteredVehicles.length ? filteredVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                className={`finance-vehicle-option${vehicle.id === selectedVehicleId ? " active" : ""}`}
                onClick={() => { setSelectedVehicleId(vehicle.id); setState("idle"); setMessage(""); }}
                aria-pressed={vehicle.id === selectedVehicleId}
              >
                <VehicleImage src={vehicle.image_url || "/em-breve.png"} alt="" />
                <span>
                  <strong>{vehicle.title}</strong>
                  <small>{vehicle.year_make}/{vehicle.year_model} · {money(vehicle.price_cents)}</small>
                </span>
              </button>
            )) : <p className="finance-empty">{eligibleVehicles.length ? "Nenhum veículo encontrado nessa busca." : <>A seleção de parceiros está em atualização. <a href="https://wa.me/5511934718276">Consulte nossa equipe pelo WhatsApp.</a></>}</p>}
          </div>
        </div>
      ) : (
        <label>Veículo da negociação particular
          <input name="desiredVehicle" required={target === "network"} maxLength={180} placeholder="Ex.: Honda HR-V 2021 automático" />
        </label>
      )}

      <label>Nome<input name="name" required maxLength={120} autoComplete="name" /></label>
      <div className="form-row">
        <label>Telefone<input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" /></label>
        <label>E-mail<input name="email" type="email" maxLength={160} autoComplete="email" /></label>
      </div>
      <div className="form-row">
        <label>Entrada aproximada<input name="downPayment" maxLength={40} placeholder="Ex.: R$ 20.000" /></label>
        <label>Parcela desejada<input name="installmentGoal" maxLength={40} placeholder="Ex.: até R$ 1.800" /></label>
      </div>
      <label>Observações<textarea name="message" maxLength={1200} rows={4} placeholder="Conte se possui troca, prazo ou alguma condição importante." /></label>
      <label className="consent"><input name="consent" type="checkbox" value="yes" required /> Autorizo o contato sobre esta solicitação e li a <a href="/privacidade">Política de Privacidade</a>.</label>
      <button className="button" disabled={state === "sending" || (service === "partners" && !eligibleVehicles.length)}>{state === "sending" ? "Enviando..." : service === "partners" ? "Enviar simulação" : "Enviar solicitação"}</button>
      <p className={`form-status ${state}`} aria-live="polite">{message}</p>
    </form>
  );
}
