import nodemailer from "nodemailer";
import { query } from "@/lib/db";
import { getEmailSettings, isEmail, type EmailSettings } from "@/lib/email-settings";
import { FINANCING_SERVICES, resolveFinancingService } from "./financing";

export type LeadKind = "contact" | "financing" | "sell_car" | "wholesale" | "partner" | "find_car" | "vehicle_interest";

export type LeadNotification = {
  id: string;
  kind: LeadKind;
  name: string;
  email: string;
  phone: string;
  message: string;
  companyName?: string;
  cnpj?: string;
  details?: Record<string, unknown>;
  vehicle?: { title: string; priceCents: number; imageUrl: string | null; slug: string; code: string | null } | null;
};

const kindLabels: Record<LeadKind, string> = {
  contact: "Contato",
  financing: "Financiamento",
  sell_car: "Venda ou troca de veículo",
  wholesale: "Atacado",
  partner: "Parceiro lojista",
  find_car: "Autodrive Busca",
  vehicle_interest: "Interesse em veículo",
};

const intentLabels: Record<string, string> = {
  simulacao: "Simulação de financiamento",
  interesse: "Interesse no veículo",
  visita: "Agendamento de visita",
};

// Rótulos amigáveis dos campos que aparecem no e-mail interno.
const detailLabels: Record<string, string> = {
  intent: "Solicitação",
  paymentMethod: "Forma de pagamento",
  downPayment: "Entrada",
  installments: "Prazo desejado",
  installmentGoal: "Parcela desejada",
  hasTrade: "Carro na troca",
  tradeVehicle: "Veículo da troca",
  tradeYear: "Ano da troca",
  tradeMileage: "Km da troca",
  visitDate: "Data preferida",
  visitPeriod: "Período",
  city: "Cidade",
  brand: "Marca",
  model: "Modelo",
  version: "Versão",
  year: "Ano",
  yearMin: "Ano mínimo",
  mileage: "Km",
  targetPrice: "Valor pretendido",
  budget: "Orçamento",
  wantsFinancing: "Pretende financiar",
  selectedVehicleLabel: "Veículo",
  desiredVehicle: "Veículo desejado",
  utmSource: "Origem (utm_source)",
  utmCampaign: "Campanha",
  pageUrl: "Página",
};

function siteUrl() {
  return (process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.appautodrive.com.br").replace(/\/$/, "");
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function protocolOf(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function leadLabel(lead: LeadNotification) {
  const intent = String(lead.details?.intent ?? "");
  if (intentLabels[intent]) return intentLabels[intent];
  const service = lead.kind === "financing" ? resolveFinancingService(lead.details?.financingService, lead.details?.financingTarget) : null;
  return service ? FINANCING_SERVICES[service].label : kindLabels[lead.kind];
}

function detailRows(lead: LeadNotification) {
  const rows: [string, string][] = [];
  for (const [key, label] of Object.entries(detailLabels)) {
    const value = lead.details?.[key];
    if (value === undefined || value === null || value === "" || typeof value === "object") continue;
    rows.push([label, key === "intent" ? intentLabels[String(value)] ?? String(value) : String(value)]);
  }
  return rows;
}

function sender(settings: EmailSettings) {
  return { name: settings.fromName, address: settings.fromEmail };
}

function transporter(settings: EmailSettings) {
  const secure = settings.security === "ssl";
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure,
    requireTLS: !secure,
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: { minVersion: "TLSv1.2", servername: settings.host },
  });
}

async function logEmail(entry: { leadId?: string | null; kind: "lead_internal" | "lead_customer" | "test"; recipient: string; subject: string; status: "sent" | "failed" | "skipped"; error?: string }) {
  await query(
    "insert into email_log(lead_id, kind, recipient, subject, status, error) values ($1,$2,$3,$4,$5,$6)",
    [entry.leadId ?? null, entry.kind, entry.recipient.slice(0, 500), entry.subject.slice(0, 300), entry.status, entry.error?.slice(0, 500) ?? null],
  ).catch(() => undefined);
}

export function safeMailError(error: unknown) {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    code: typeof details.code === "string" ? details.code : "SMTP_ERROR",
    command: typeof details.command === "string" ? details.command : undefined,
    responseCode: typeof details.responseCode === "number" ? details.responseCode : undefined,
  };
}

function describeError(error: unknown) {
  const safe = safeMailError(error);
  const hints: Record<string, string> = {
    EAUTH: "usuário ou senha do SMTP recusados",
    ECONNECTION: "não foi possível conectar ao servidor SMTP",
    ETIMEDOUT: "o servidor SMTP não respondeu a tempo",
    ESOCKET: "falha de conexão/TLS com o servidor SMTP",
    EENVELOPE: "remetente ou destinatário recusado",
    EDNS: "servidor SMTP não encontrado",
  };
  return [hints[safe.code] ?? safe.code, safe.responseCode ? `código ${safe.responseCode}` : ""].filter(Boolean).join(" · ");
}

/* ------------------------------------------------------------------ */
/* Layout dos e-mails (tabelas + estilos inline, compatível com Outlook) */
/* ------------------------------------------------------------------ */

function layout({ preheader, title, body, footer }: { preheader: string; title: string; body: string; footer: string }) {
  const logo = `${siteUrl()}/brand/autodrive-logo-footer.png`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#eef5f6;font-family:Arial,Helvetica,sans-serif;color:#071c29">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef5f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #d4e1e4">
<tr><td style="background:#061b29;padding:22px 28px"><img src="${logo}" alt="Autodrive Veículos" width="160" style="display:block;width:160px;height:auto;border:0"></td></tr>
<tr><td style="height:4px;background:#079ca6;line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#f5f9fa;border-top:1px solid #d4e1e4;font-size:12px;line-height:1.6;color:#64737b">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string, color = "#079ca6") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px"><tr><td style="background:${color};border-radius:8px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:bold;font-size:15px;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}

function table(rows: [string, string][]) {
  if (!rows.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;font-size:14px">${rows.map(([label, value]) =>
    `<tr><td style="padding:8px 10px;border-bottom:1px solid #e6eef0;color:#64737b;width:38%;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 10px;border-bottom:1px solid #e6eef0;font-weight:bold;vertical-align:top">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>`;
}

function vehicleBlock(vehicle: NonNullable<LeadNotification["vehicle"]>) {
  const url = `${siteUrl()}/veiculos/${vehicle.slug}`;
  const image = vehicle.imageUrl ? new URL(vehicle.imageUrl, siteUrl()).toString() : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #d4e1e4;border-radius:8px;overflow:hidden"><tr>
${image ? `<td width="180" style="width:180px;vertical-align:top"><a href="${escapeHtml(url)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(vehicle.title)}" width="180" style="display:block;width:180px;height:auto;border:0"></a></td>` : ""}
<td style="padding:14px 16px;vertical-align:middle"><div style="font-size:16px;font-weight:bold;margin-bottom:4px">${escapeHtml(vehicle.title)}</div>
${vehicle.code ? `<div style="font-size:12px;color:#64737b">Código ${escapeHtml(vehicle.code)}</div>` : ""}
<div style="margin-top:8px;display:inline-block;background:#079ca6;color:#fff;font-weight:bold;padding:6px 10px;border-radius:6px">${money(vehicle.priceCents)}</div></td></tr></table>`;
}

function internalEmail(lead: LeadNotification, settings: EmailSettings) {
  const label = leadLabel(lead);
  const protocol = protocolOf(lead.id);
  const panel = `${siteUrl()}/admin/${lead.kind === "financing" ? "financiamentos" : lead.kind === "wholesale" || lead.kind === "partner" ? "atacado" : "leads"}?period=today`;
  const phoneDigits = lead.phone.replace(/\D/g, "");
  const whatsapp = `https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`}`;
  const contactRows: [string, string][] = [
    ["Nome", lead.name],
    ["Telefone / WhatsApp", lead.phone],
    ["E-mail", lead.email || "não informado"],
    ...(lead.companyName ? [["Razão social", lead.companyName] as [string, string], ["CNPJ", lead.cnpj || "não informado"] as [string, string]] : []),
  ];
  const subject = `Novo lead: ${label}${lead.vehicle ? ` — ${lead.vehicle.title}` : ""} (${lead.name})`;
  const html = layout({
    preheader: `${lead.name} · ${lead.phone} · protocolo ${protocol}`,
    title: subject,
    body: `<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#079ca6;font-weight:bold">Novo lead · ${escapeHtml(label)}</div>
<h1 style="margin:6px 0 4px;font-size:22px">${escapeHtml(lead.name)}</h1>
<div style="color:#64737b;font-size:13px">Protocolo ${protocol} · ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
${lead.vehicle ? vehicleBlock(lead.vehicle) : ""}
<h2 style="font-size:15px;margin:20px 0 0">Contato</h2>${table(contactRows)}
${detailRows(lead).length ? `<h2 style="font-size:15px;margin:20px 0 0">Detalhes</h2>${table(detailRows(lead))}` : ""}
${lead.message ? `<h2 style="font-size:15px;margin:20px 0 6px">Mensagem</h2><div style="background:#f5f9fa;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.55">${escapeHtml(lead.message).replace(/\n/g, "<br>")}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${button(whatsapp, "Chamar no WhatsApp", "#16a34a")}</td><td style="width:10px"></td><td>${button(panel, "Abrir no painel")}</td></tr></table>`,
    footer: `Aviso automático do site Autodrive. Responder este e-mail escreve direto para o cliente${lead.email ? ` (${escapeHtml(lead.email)})` : ""}.<br>O consentimento de contato foi registrado no painel.`,
  });
  const text = [
    `Novo lead: ${label}`, `Protocolo: ${protocol}`, "",
    ...contactRows.map(([k, v]) => `${k}: ${v}`),
    ...(lead.vehicle ? ["", `Veículo: ${lead.vehicle.title} (${money(lead.vehicle.priceCents)})`] : []),
    "", ...detailRows(lead).map(([k, v]) => `${k}: ${v}`),
    "", "Mensagem:", lead.message, "", `Painel: ${panel}`,
  ].join("\r\n");
  return { subject, html, text, replyTo: lead.email && isEmail(lead.email) ? lead.email : settings.replyTo || undefined };
}

function customerEmail(lead: LeadNotification, settings: EmailSettings) {
  const label = leadLabel(lead);
  const protocol = protocolOf(lead.id);
  const firstName = lead.name.trim().split(/\s+/)[0] || "cliente";
  const whatsDigits = settings.whatsapp.replace(/\D/g, "");
  const whatsapp = `https://wa.me/${whatsDigits.startsWith("55") ? whatsDigits : `55${whatsDigits}`}?text=${encodeURIComponent(`Olá! Enviei uma solicitação pelo site (protocolo ${protocol}).`)}`;
  const summary = detailRows(lead).filter(([labelName]) => !/Página|utm|Campanha/i.test(labelName));
  const subject = `Recebemos sua solicitação — protocolo ${protocol}`;
  const html = layout({
    preheader: `Olá ${firstName}, sua solicitação de ${label.toLowerCase()} chegou à Autodrive.`,
    title: subject,
    body: `<h1 style="margin:0 0 8px;font-size:22px">Olá, ${escapeHtml(firstName)}!</h1>
<p style="margin:0 0 10px;font-size:15px;line-height:1.6">Recebemos sua solicitação de <b>${escapeHtml(label.toLowerCase())}</b>. Um consultor da Autodrive vai analisar as informações e falar com você em breve, normalmente no mesmo dia útil.</p>
<div style="display:inline-block;margin:6px 0 4px;padding:8px 12px;background:#eef5f6;border-radius:6px;font-size:13px">Protocolo <b>${protocol}</b></div>
${lead.vehicle ? vehicleBlock(lead.vehicle) : ""}
${summary.length ? `<h2 style="font-size:15px;margin:18px 0 0">Resumo do que você enviou</h2>${table(summary)}` : ""}
<p style="margin:16px 0 0;font-size:14px;line-height:1.6">Quer adiantar o atendimento? Fale com a gente pelo WhatsApp:</p>
${button(whatsapp, `WhatsApp ${settings.whatsapp}`, "#16a34a")}`,
    footer: `<b>Este é um e-mail automático, por favor não responda.</b> Para falar com a Autodrive, use o WhatsApp ${escapeHtml(settings.whatsapp)}${settings.replyTo ? ` ou o e-mail ${escapeHtml(settings.replyTo)}` : ""}.<br>Você recebeu esta mensagem porque enviou uma solicitação em ${escapeHtml(siteUrl().replace(/^https?:\/\//, ""))}. Seus dados são tratados conforme a nossa <a href="${siteUrl()}/privacidade" style="color:#079ca6">Política de Privacidade</a>.`,
  });
  const text = [
    `Olá, ${firstName}!`, "",
    `Recebemos sua solicitação de ${label.toLowerCase()}. Um consultor da Autodrive vai falar com você em breve.`,
    `Protocolo: ${protocol}`,
    ...(lead.vehicle ? [`Veículo: ${lead.vehicle.title} (${money(lead.vehicle.priceCents)})`] : []),
    "", ...summary.map(([k, v]) => `${k}: ${v}`), "",
    `WhatsApp: ${settings.whatsapp}`, "",
    "Este é um e-mail automático, por favor não responda.",
  ].join("\r\n");
  return { subject, html, text };
}

/**
 * Avisa a equipe e confirma ao cliente. Cada envio é registrado em email_log;
 * uma falha de SMTP nunca derruba o lead, que já está salvo.
 */
export async function sendLeadNotification(lead: LeadNotification) {
  const { settings } = await getEmailSettings();
  if (!settings.enabled || !settings.host || !settings.password || !settings.fromEmail) {
    await logEmail({ leadId: lead.id, kind: "lead_internal", recipient: settings.leadRecipients.join(", ") || "—", subject: "E-mail desativado no painel", status: "skipped", error: "Envio de e-mail desativado ou incompleto em Configurações → E-mails." });
    return "disabled" as const;
  }
  const mailer = transporter(settings);
  const internal = internalEmail(lead, settings);
  try {
    await mailer.sendMail({
      from: sender(settings),
      to: settings.leadRecipients,
      replyTo: internal.replyTo,
      subject: internal.subject,
      text: internal.text,
      html: internal.html,
      headers: { "X-Autodrive-Lead": lead.id },
    });
    await logEmail({ leadId: lead.id, kind: "lead_internal", recipient: settings.leadRecipients.join(", "), subject: internal.subject, status: "sent" });
  } catch (error) {
    await logEmail({ leadId: lead.id, kind: "lead_internal", recipient: settings.leadRecipients.join(", "), subject: internal.subject, status: "failed", error: describeError(error) });
    console.error("Falha ao avisar a equipe sobre novo lead", safeMailError(error));
  }

  if (settings.notifyCustomer && lead.email && isEmail(lead.email)) {
    const customer = customerEmail(lead, settings);
    try {
      await mailer.sendMail({
        from: sender(settings),
        to: { name: lead.name, address: lead.email },
        // "Não responda": sem Reply-To de pessoa; o rodapé indica os canais.
        replyTo: settings.fromEmail,
        subject: customer.subject,
        text: customer.text,
        html: customer.html,
        headers: { "Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All" },
      });
      await logEmail({ leadId: lead.id, kind: "lead_customer", recipient: lead.email, subject: customer.subject, status: "sent" });
    } catch (error) {
      await logEmail({ leadId: lead.id, kind: "lead_customer", recipient: lead.email, subject: customer.subject, status: "failed", error: describeError(error) });
      console.error("Falha ao confirmar lead ao cliente", safeMailError(error));
    }
  }
  return "sent" as const;
}

/** Botão "Enviar teste" do painel: usa a configuração informada, salva ou não. */
export async function sendTestEmail(settings: EmailSettings, to: string) {
  const subject = "Teste de e-mail — Autodrive Veículos";
  try {
    const mailer = transporter(settings);
    await mailer.verify();
    await mailer.sendMail({
      from: sender(settings),
      to,
      subject,
      text: "Este é um e-mail de teste enviado pelo painel da Autodrive. Se chegou, o envio de leads está funcionando.",
      html: layout({
        preheader: "Configuração de e-mail funcionando.",
        title: subject,
        body: `<h1 style="margin:0 0 8px;font-size:22px">Tudo certo! ✅</h1><p style="font-size:15px;line-height:1.6">Este é um e-mail de teste enviado pelo painel da Autodrive. Se ele chegou, os avisos de novos leads e as confirmações para clientes vão funcionar com esta configuração.</p>${table([["Servidor", `${settings.host}:${settings.port}`], ["Remetente", `${settings.fromName} <${settings.fromEmail}>`], ["Recebem leads", settings.leadRecipients.join(", ") || "—"]])}`,
        footer: "Mensagem automática de teste.",
      }),
    });
    await logEmail({ kind: "test", recipient: to, subject, status: "sent" });
    return { ok: true as const };
  } catch (error) {
    const message = describeError(error);
    await logEmail({ kind: "test", recipient: to, subject, status: "failed", error: message });
    return { ok: false as const, error: message };
  }
}
