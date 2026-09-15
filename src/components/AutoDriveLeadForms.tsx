"use client";

import { useState, type FormEvent } from "react";
import { formatCnpj } from "@/lib/cnpj";
import { useMetaPixel } from "@/components/MetaPixelProvider";

type FormState = "idle" | "sending" | "done" | "error";
type LeadKind = "sell_car" | "partner" | "find_car";

function payloadFromForm(form: HTMLFormElement, kind: LeadKind) {
  const data = new FormData(form);
  const payload: Record<string, unknown> = { kind };
  for (const [key, value] of data.entries()) {
    if (value instanceof File) continue;
    const current = payload[key];
    if (current) payload[key] = Array.isArray(current) ? [...current, value] : [current, value];
    else payload[key] = value;
  }
  const url = new URL(window.location.href);
  payload.pageUrl = url.href;
  payload.leadSource = "site";
  payload.utmSource = url.searchParams.get("utm_source") || "";
  payload.utmMedium = url.searchParams.get("utm_medium") || "";
  payload.utmCampaign = url.searchParams.get("utm_campaign") || "";
  return payload;
}

function useLeadSubmit(kind: LeadKind, successMessage: string, eventName: string) {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const { track } = useMetaPixel();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setMessage("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form, kind)),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar agora.");
      form.reset();
      setState("done");
      setMessage(successMessage);
      track("Lead", { lead_type: kind });
      track(eventName, { lead_type: kind }, true);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar agora. Tente novamente.");
    }
  }

  return { state, message, submit };
}

export function SellCarLeadForm() {
  const { state, message, submit } = useLeadSubmit(
    "sell_car",
    "Recebemos seu veículo. Nossa equipe analisará as informações e entrará em contato pelo WhatsApp.",
    "SubmitSellCar",
  );

  return (
    <form className="lead-form structured-form" onSubmit={submit}>
      <h2>Quero vender meu carro</h2>
      <p className="form-help">Campos com * são obrigatórios.</p>
      <h3>Proprietário</h3>
      <label>Nome *<input name="name" required maxLength={120} autoComplete="name" /></label>
      <div className="form-row">
        <label>WhatsApp *<input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" /></label>
        <label>E-mail<input name="email" type="email" maxLength={160} autoComplete="email" /></label>
      </div>
      <label>Cidade *<input name="city" required maxLength={100} autoComplete="address-level2" /></label>

      <h3>Veículo</h3>
      <div className="form-row">
        <label>Marca *<input name="brand" required maxLength={80} /></label>
        <label>Modelo *<input name="model" required maxLength={100} /></label>
      </div>
      <label>Versão<input name="version" maxLength={140} /></label>
      <div className="form-row">
        <label>Ano *<input name="year" required inputMode="numeric" maxLength={9} placeholder="Ex.: 2020/2021" /></label>
        <label>Quilometragem *<input name="mileage" required inputMode="numeric" maxLength={20} /></label>
      </div>
      <div className="form-row">
        <label>Câmbio<input name="transmission" maxLength={60} /></label>
        <label>Combustível<input name="fuel" maxLength={60} /></label>
      </div>
      <div className="form-row">
        <label>Placa<input name="plate" maxLength={10} autoCapitalize="characters" /></label>
        <label>Cor<input name="color" maxLength={60} /></label>
      </div>
      <label>Valor pretendido *<input name="targetPrice" required inputMode="numeric" maxLength={30} placeholder="Ex.: R$ 75.000" /></label>

      <h3>Situação</h3>
      <div className="checkbox-grid">
        <label><input type="checkbox" name="vehicleStatus" value="Quitado" />Quitado</label>
        <label><input type="checkbox" name="vehicleStatus" value="Financiado" />Financiado</label>
        <label><input type="checkbox" name="vehicleStatus" value="Possui débitos" />Possui débitos</label>
        <label><input type="checkbox" name="vehicleStatus" value="Possui sinistro" />Possui sinistro</label>
        <label><input type="checkbox" name="vehicleStatus" value="Possui leilão" />Possui leilão</label>
      </div>
      <label>Fotos<textarea name="photoLinks" rows={3} maxLength={1200} placeholder="Cole links das fotos, um por linha" /></label>
      <label>Observações<textarea name="message" rows={4} maxLength={2000} /></label>
      <label className="consent"><input name="consent" type="checkbox" value="yes" required /> Autorizo o contato sobre esta solicitação e li a <a href="/privacidade">Política de Privacidade</a>.</label>
      <button className="button" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : "Enviar meu veículo"}</button>
      <p className={`form-status ${state}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}

export function PartnerLeadForm() {
  const { state, message, submit } = useLeadSubmit(
    "partner",
    "Solicitação recebida. A Autodrive entrará em contato para conhecer sua operação e apresentar a parceria.",
    "SubmitPartner",
  );

  return (
    <form className="lead-form structured-form" onSubmit={submit}>
      <h2>Quero ser parceiro</h2>
      <p className="form-help">Campos com * são obrigatórios.</p>
      <label>Razão social *<input name="companyName" required maxLength={160} autoComplete="organization" /></label>
      <div className="form-row">
        <label>Nome fantasia<input name="tradeName" maxLength={160} /></label>
        <label>CNPJ *<input name="cnpj" required inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" onInput={(event) => { event.currentTarget.value = formatCnpj(event.currentTarget.value); }} /></label>
      </div>
      <div className="form-row">
        <label>Responsável *<input name="name" required maxLength={120} autoComplete="name" /></label>
        <label>WhatsApp *<input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" /></label>
      </div>
      <div className="form-row">
        <label>E-mail *<input name="email" type="email" required maxLength={160} autoComplete="email" /></label>
        <label>Cidade *<input name="city" required maxLength={100} /></label>
      </div>
      <label>Endereço comercial<input name="address" maxLength={220} /></label>
      <div className="form-row">
        <label>Instagram<input name="instagram" maxLength={120} /></label>
        <label>Site<input name="website" maxLength={180} /></label>
      </div>
      <div className="form-row">
        <label>Quantidade média em estoque<input name="averageInventory" inputMode="numeric" maxLength={20} /></label>
        <label>Sistema atual<input name="currentSystem" maxLength={120} /></label>
      </div>
      <h3>Como deseja trabalhar conosco?</h3>
      <div className="checkbox-grid">
        <label><input type="checkbox" name="desiredWork" value="Divulgação do estoque" />Divulgação do estoque</label>
        <label><input type="checkbox" name="desiredWork" value="Geração de leads" />Geração de leads</label>
        <label><input type="checkbox" name="desiredWork" value="Intermediação" />Intermediação</label>
        <label><input type="checkbox" name="desiredWork" value="Financiamento" />Financiamento</label>
        <label><input type="checkbox" name="desiredWork" value="Autodrive Gestão" />Autodrive Gestão</label>
      </div>
      <label>Observações<textarea name="message" rows={4} maxLength={2000} /></label>
      <label className="consent"><input name="consent" type="checkbox" value="yes" required /> Autorizo o contato sobre esta solicitação e li a <a href="/privacidade">Política de Privacidade</a>.</label>
      <button className="button" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : "Enviar cadastro"}</button>
      <p className={`form-status ${state}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}

export function FindCarLeadForm() {
  const { state, message, submit } = useLeadSubmit(
    "find_car",
    "Recebemos sua busca. A equipe vai procurar opções na rede Autodrive e chamar você pelo WhatsApp.",
    "SubmitFindCar",
  );

  return (
    <form className="lead-form structured-form" onSubmit={submit}>
      <h2>Encontre meu carro</h2>
      <p className="form-help">Campos com * são obrigatórios.</p>
      <div className="form-row">
        <label>Nome *<input name="name" required maxLength={120} autoComplete="name" /></label>
        <label>WhatsApp *<input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" /></label>
      </div>
      <div className="form-row">
        <label>Marca *<input name="brand" required maxLength={80} /></label>
        <label>Modelo *<input name="model" required maxLength={100} /></label>
      </div>
      <div className="form-row">
        <label>Ano mínimo<input name="yearMin" inputMode="numeric" maxLength={4} /></label>
        <label>Orçamento *<input name="budget" required inputMode="numeric" maxLength={30} placeholder="Ex.: até R$ 90.000" /></label>
      </div>
      <div className="form-row">
        <label>Entrada<input name="downPayment" inputMode="numeric" maxLength={30} /></label>
        <label>Possui carro na troca?<select name="hasTrade"><option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option></select></label>
      </div>
      <label>Pretende financiar?<select name="wantsFinancing"><option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option><option value="Ainda não sei">Ainda não sei</option></select></label>
      <label>Observações<textarea name="message" rows={4} maxLength={2000} placeholder="Versões, cores, opcionais ou lojas onde já pesquisou" /></label>
      <label className="consent"><input name="consent" type="checkbox" value="yes" required /> Autorizo o contato sobre esta solicitação e li a <a href="/privacidade">Política de Privacidade</a>.</label>
      <button className="button" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : "Encontrar meu carro"}</button>
      <p className={`form-status ${state}`} role="status" aria-live="polite">{message}</p>
    </form>
  );
}
