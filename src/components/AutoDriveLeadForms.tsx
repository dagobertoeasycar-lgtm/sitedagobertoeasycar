"use client";

import { useState, type FormEvent } from "react";
import { fireAdsConversion } from "@/lib/ads-conversions";
import { formatCnpj } from "@/lib/cnpj";
import { useMetaPixel } from "@/components/MetaPixelProvider";

type FormState = "idle" | "sending" | "done" | "error";
type LeadKind = "sell_car" | "partner" | "find_car";

const SELL_CAR_PHOTO_FIELDS = [
  { name: "photoDashboard", label: "Painel", required: true },
  { name: "photoFrontSeats", label: "Interno - bancos dianteiros", required: true },
  { name: "photoRearSeats", label: "Interno - bancos traseiros", required: true },
  { name: "photoFront", label: "Frente", required: true },
  { name: "photoEngine", label: "Motor", required: true },
  { name: "photoRoof", label: "Teto", required: true },
  { name: "photoFrontDetails", label: "Detalhes da frente, se tiver" },
  { name: "photoRightSide", label: "Lateral direita", required: true },
  { name: "photoRightTires", label: "Pneus lado direito", required: true },
  { name: "photoRightDetails", label: "Detalhes do lado direito, se tiver" },
  { name: "photoRear", label: "Traseira", required: true },
  { name: "photoRearTrunkOpen", label: "Traseira com porta-malas aberto", required: true },
  { name: "photoSpareTire", label: "Estepe", required: true },
  { name: "photoSafetyItems", label: "Itens de segurança", required: true },
  { name: "photoLeftSide", label: "Lado esquerdo", required: true },
  { name: "photoLeftTires", label: "Pneus lado esquerdo", required: true },
  { name: "photoLeftDetails", label: "Detalhes do lado esquerdo, se tiver" },
] as const;

const EXTRA_PHOTO_FIELD = { name: "photoExtraDetails", label: "Fotos de mais detalhes, se quiser" } as const;
const photoFieldNames = new Set<string>([...SELL_CAR_PHOTO_FIELDS.map((field) => field.name), EXTRA_PHOTO_FIELD.name]);
const photoMaxEdge = 1400;
const photoQuality = 0.78;

function trackingPayload() {
  const url = new URL(window.location.href);
  return {
    pageUrl: url.href,
    leadSource: "site",
    utmSource: url.searchParams.get("utm_source") || "",
    utmMedium: url.searchParams.get("utm_medium") || "",
    utmCampaign: url.searchParams.get("utm_campaign") || "",
  };
}

function payloadFromForm(form: HTMLFormElement, kind: LeadKind) {
  const data = new FormData(form);
  const payload: Record<string, unknown> = { kind, ...trackingPayload() };
  for (const [key, value] of data.entries()) {
    if (value instanceof File) continue;
    const current = payload[key];
    if (current) payload[key] = Array.isArray(current) ? [...current, value] : [current, value];
    else payload[key] = value;
  }
  return payload;
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", photoQuality));
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, photoMaxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await canvasToBlob(canvas);
    if (!blob || blob.size >= file.size) return file;
    const basename = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${basename}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

async function multipartPayloadFromForm(form: HTMLFormElement, kind: LeadKind) {
  const source = new FormData(form);
  const target = new FormData();
  for (const [key, value] of source.entries()) {
    if (value instanceof File) {
      if (!photoFieldNames.has(key) || value.size === 0) continue;
      target.append(key, await compressPhoto(value));
      continue;
    }
    target.append(key, value);
  }
  target.set("kind", kind);
  for (const [key, value] of Object.entries(trackingPayload())) target.set(key, value);
  return target;
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
      const hasUploads = kind === "sell_car";
      const response = await fetch("/api/leads", {
        method: "POST",
        ...(hasUploads
          ? { body: await multipartPayloadFromForm(form, kind) }
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadFromForm(form, kind)) }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar agora.");
      form.reset();
      setState("done");
      setMessage(successMessage);
      track("Lead", { lead_type: kind });
      fireAdsConversion("lead", { lead_type: kind });
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
    "Recebemos sua pré-avaliação. Nossa equipe analisará as fotos e informações e entrará em contato pelo WhatsApp.",
    "SubmitSellCar",
  );

  return (
    <form className="lead-form structured-form" encType="multipart/form-data" onSubmit={submit}>
      <h2>Pré-avaliação do veículo</h2>
      <p className="form-help">Campos com * são obrigatórios. As fotos são enviadas em tamanho otimizado para pré-avaliação.</p>
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
      <h3>Fotos para pré-avaliação</h3>
      <p className="form-help">Use fotos reais e recentes. Os campos “detalhes” são opcionais e servem para riscos, amassados, avarias ou pontos importantes.</p>
      <div className="photo-upload-grid">
        {SELL_CAR_PHOTO_FIELDS.map((field) => (
          <label key={field.name} className="photo-upload-card">
            <span>{field.label}{"required" in field && field.required ? " *" : ""}</span>
            <input name={field.name} type="file" accept="image/*" capture="environment" required={"required" in field && field.required} />
          </label>
        ))}
        <label className="photo-upload-card photo-upload-card-wide">
          <span>{EXTRA_PHOTO_FIELD.label}</span>
          <input name={EXTRA_PHOTO_FIELD.name} type="file" accept="image/*" capture="environment" multiple />
        </label>
      </div>
      <label>Observações<textarea name="message" rows={4} maxLength={2000} /></label>
      <label className="consent"><input name="consent" type="checkbox" value="yes" required /> Autorizo o contato sobre esta solicitação e li a <a href="/privacidade">Política de Privacidade</a>.</label>
      <button className="button" disabled={state === "sending"}>{state === "sending" ? "Enviando fotos..." : "Enviar pré-avaliação"}</button>
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
