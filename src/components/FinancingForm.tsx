"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState, type FormEvent } from "react";
import { useMetaPixel } from "@/components/MetaPixelProvider";
import type { VehicleChoice } from "@/lib/vehicles";

type FinancingTarget = "site" | "network";

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function FinancingForm({ vehicles }: { vehicles: VehicleChoice[] }) {
  const [target, setTarget] = useState<FinancingTarget>("site");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage] = useState("");
  const { track } = useMetaPixel();

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null;
  const filteredVehicles = useMemo(() => {
    const search = normalized(vehicleQuery.trim());
    const list = search
      ? vehicles.filter((vehicle) => normalized(`${vehicle.title} ${vehicle.brand} ${vehicle.model} ${vehicle.version} ${vehicle.catalog_item_id}`).includes(search))
      : vehicles;
    return list.slice(0, 8);
  }, [vehicleQuery, vehicles]);

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

  function selectTarget(nextTarget: FinancingTarget) {
    setTarget(nextTarget);
    setState("idle");
    setMessage("");
    if (nextTarget === "network") setSelectedVehicleId("");
    if (nextTarget === "site" && !selectedVehicleId) setSelectedVehicleId(vehicles[0]?.id ?? "");
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
      setMessage("Escolha um veículo do site para continuar.");
      return;
    }
    if (target === "network" && desiredVehicle.length < 2) {
      setState("error");
      setMessage("Informe qual veículo você quer financiar.");
      return;
    }

    const targetLabel = target === "site" ? "Veículo do site" : "Amigos e conhecidos";
    const vehicleLabel = selectedVehicle
      ? `${selectedVehicle.title} (${selectedVehicle.catalog_item_id})`
      : desiredVehicle;
    const leadMessage = [
      `Solicitação de financiamento: ${targetLabel}.`,
      `Veículo: ${vehicleLabel}`,
      form.get("downPayment") ? `Entrada informada: ${form.get("downPayment")}` : "",
      form.get("installmentGoal") ? `Parcela desejada: ${form.get("installmentGoal")}` : "",
      notes ? `Observações: ${notes}` : "",
    ].filter(Boolean).join("\n");

    track("InitiateVehicleFinancing", { lead_type: "financing", financing_target: target }, true);
    const payload = {
      ...Object.fromEntries(form.entries()),
      kind: "financing",
      financingTarget: target,
      vehicleId: selectedVehicle?.id ?? "",
      vehicleTitle: vehicleLabel,
      selectedVehicleLabel: vehicleLabel,
      vehicleOriginType: selectedVehicle?.origin_type ?? "",
      message: leadMessage,
      ...trackingPayload(),
    };

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      track("Lead", { lead_type: "financing", financing_target: target });
      window.location.assign("/financiamento/sucesso");
      return;
    }

    setState("error");
    setMessage("Não foi possível enviar agora. Tente novamente ou fale pelo WhatsApp.");
  }

  return (
    <form className="lead-form finance-form" onSubmit={submit}>
      <h2>Simular financiamento</h2>

      <fieldset className="finance-choice">
        <legend>Escolha a origem do veículo</legend>
        <label className={target === "site" ? "active" : ""}>
          <input type="radio" name="financingTarget" value="site" checked={target === "site"} onChange={() => selectTarget("site")} />
          <span>
            <strong>Veículo do site</strong>
            <small>Escolha um anúncio publicado na vitrine.</small>
          </span>
        </label>
        <label className={target === "network" ? "active" : ""}>
          <input type="radio" name="financingTarget" value="network" checked={target === "network"} onChange={() => selectTarget("network")} />
          <span>
            <strong>Amigos e conhecidos</strong>
            <small>Informe o veículo que quer financiar.</small>
          </span>
        </label>
      </fieldset>

      {target === "site" ? (
        <div className="finance-vehicle-picker">
          <label>Buscar veículo do site
            <input value={vehicleQuery} onChange={(event) => setVehicleQuery(event.currentTarget.value)} placeholder="Ex.: Corolla, Compass, automático" />
          </label>
          <input type="hidden" name="vehicleId" value={selectedVehicle?.id ?? ""} />
          <input type="hidden" name="vehicleTitle" value={selectedVehicle ? `${selectedVehicle.title} (${selectedVehicle.catalog_item_id})` : ""} />
          <div className="finance-vehicle-list" role="listbox" aria-label="Veículos encontrados">
            {filteredVehicles.length ? filteredVehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                className={`finance-vehicle-option${vehicle.id === selectedVehicleId ? " active" : ""}`}
                onClick={() => setSelectedVehicleId(vehicle.id)}
                aria-pressed={vehicle.id === selectedVehicleId}
              >
                <img src={vehicle.image_url || "/em-breve.jpg"} alt="" loading="lazy" />
                <span>
                  <strong>{vehicle.title}</strong>
                  <small>{vehicle.year_make}/{vehicle.year_model} · {money(vehicle.price_cents)}</small>
                </span>
              </button>
            )) : <p className="finance-empty">Nenhum veículo encontrado nessa busca.</p>}
          </div>
        </div>
      ) : (
        <label>Veículo de amigos ou conhecidos
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
      <button className="button" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : "Enviar simulação"}</button>
      <p className={`form-status ${state}`} aria-live="polite">{message}</p>
    </form>
  );
}
