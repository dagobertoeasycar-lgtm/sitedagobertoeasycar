import nodemailer, { type Transporter } from "nodemailer";

type LeadNotification = {
  id: string;
  kind: "contact" | "financing" | "sell_car" | "wholesale";
  name: string;
  email: string;
  phone: string;
  message: string;
  companyName?: string;
  cnpj?: string;
};

type SmtpSettings = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
};

declare global {
  var dagobertoMailer: Transporter | undefined;
}

const kindLabels: Record<LeadNotification["kind"], string> = {
  contact: "Contato",
  financing: "Financiamento",
  sell_car: "Venda ou troca de veículo",
  wholesale: "Atacado",
};

function smtpSettings(): SmtpSettings | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER?.trim() ?? "";
  const password = process.env.SMTP_PASSWORD ?? "";
  const from = process.env.SMTP_FROM?.trim() ?? "";
  const to = process.env.ADMIN_EMAIL?.trim() ?? "";
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from || !to) return null;
  return { host, port, user, password, from, to };
}

function transporter(settings: SmtpSettings) {
  if (!globalThis.dagobertoMailer) {
    const secure = settings.port === 465;
    globalThis.dagobertoMailer = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure,
      requireTLS: !secure,
      auth: { user: settings.user, pass: settings.password },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 15_000,
      disableFileAccess: true,
      disableUrlAccess: true,
      tls: { minVersion: "TLSv1.2", servername: settings.host },
    });
  }
  return globalThis.dagobertoMailer;
}

export async function sendLeadNotification(lead: LeadNotification) {
  const settings = smtpSettings();
  if (!settings) return "disabled" as const;
  const text = [
    "Novo lead recebido pelo site Dagoberto Easycar.",
    "",
    `Protocolo: ${lead.id}`,
    `Tipo: ${kindLabels[lead.kind]}`,
    `Nome: ${lead.name}`,
    `Telefone: ${lead.phone}`,
    `E-mail: ${lead.email || "não informado"}`,
    ...(lead.kind === "wholesale" ? [`Razão social: ${lead.companyName || lead.name}`, `CNPJ: ${lead.cnpj || "não informado"}`] : []),
    "",
    "Mensagem:",
    lead.message,
    "",
    "O consentimento para contato foi registrado no banco de dados.",
  ].join("\r\n");
  await transporter(settings).sendMail({
    from: settings.from,
    to: settings.to,
    replyTo: lead.email || undefined,
    subject: `[Site] Novo lead — ${kindLabels[lead.kind]}`,
    text,
  });
  return "sent" as const;
}

export function safeMailError(error: unknown) {
  const details = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    code: typeof details.code === "string" ? details.code : "SMTP_ERROR",
    command: typeof details.command === "string" ? details.command : undefined,
    responseCode: typeof details.responseCode === "number" ? details.responseCode : undefined,
  };
}
