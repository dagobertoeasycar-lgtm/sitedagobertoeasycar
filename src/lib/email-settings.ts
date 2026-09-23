/**
 * Configuração de e-mail editada no painel (Configurações → E-mails).
 * SOMENTE SERVIDOR. A senha do SMTP é gravada cifrada (AES-256-GCM com chave
 * derivada do AUTH_SECRET) e nunca volta para o navegador.
 * Sem configuração salva no painel, vale o que estiver nas variáveis SMTP_*.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { query } from "@/lib/db";

export type SmtpSecurity = "starttls" | "ssl";

export type EmailSettings = {
  enabled: boolean;
  host: string;
  port: number;
  security: SmtpSecurity;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  leadRecipients: string[];
  notifyCustomer: boolean;
  whatsapp: string;
};

/** O que o painel recebe: tudo, menos a senha. */
export type PublicEmailSettings = Omit<EmailSettings, "password"> & { hasPassword: boolean; source: "panel" | "env" | "none" };

const SETTING_KEY = "email_settings";
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  enabled: false,
  host: "",
  port: 587,
  security: "starttls",
  user: "",
  password: "",
  fromName: "Autodrive Veículos",
  fromEmail: "",
  replyTo: "",
  leadRecipients: [],
  notifyCustomer: true,
  whatsapp: "(11) 93471-8276",
};

export function isEmail(value: string) {
  return value.length <= 254 && EMAIL_RE.test(value);
}

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET precisa ter ao menos 32 caracteres");
  return createHash("sha256").update(`email-settings:${secret}`).digest();
}

function encrypt(plain: string) {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

function decrypt(value: string) {
  if (!value) return "";
  const [version, iv, tag, data] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    // AUTH_SECRET trocado: a senha precisa ser digitada de novo no painel.
    return "";
  }
}

function recipients(raw: unknown) {
  const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/[,;\n]/);
  return [...new Set(list.map((item) => String(item).trim().toLowerCase()).filter(isEmail))].slice(0, 10);
}

function fromEnv(): EmailSettings | null {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  const password = process.env.SMTP_PASSWORD ?? "";
  const from = process.env.SMTP_FROM?.trim() ?? "";
  const admin = recipients(process.env.ADMIN_EMAIL ?? "");
  if (!host || !user || !password || !from || !admin.length) return null;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  return {
    ...DEFAULT_EMAIL_SETTINGS,
    enabled: true,
    host,
    port: Number.isInteger(port) ? port : 587,
    security: port === 465 ? "ssl" : "starttls",
    user,
    password,
    fromName: match?.[1]?.trim() || DEFAULT_EMAIL_SETTINGS.fromName,
    fromEmail: match?.[2]?.trim() || from,
    leadRecipients: admin,
  };
}

async function readStored(): Promise<(Omit<EmailSettings, "password"> & { passwordEnc: string }) | null> {
  try {
    const result = await query<{ value: Record<string, unknown> }>("SELECT value FROM app_settings WHERE key = $1", [SETTING_KEY]);
    const raw = result.rows[0]?.value;
    if (!raw || typeof raw !== "object") return null;
    const port = Math.trunc(Number(raw.port));
    return {
      enabled: raw.enabled === true,
      host: String(raw.host ?? "").trim(),
      port: port >= 1 && port <= 65535 ? port : 587,
      security: raw.security === "ssl" ? "ssl" : "starttls",
      user: String(raw.user ?? "").trim(),
      passwordEnc: String(raw.passwordEnc ?? ""),
      fromName: String(raw.fromName ?? DEFAULT_EMAIL_SETTINGS.fromName).trim().slice(0, 80),
      fromEmail: String(raw.fromEmail ?? "").trim(),
      replyTo: String(raw.replyTo ?? "").trim(),
      leadRecipients: recipients(raw.leadRecipients),
      notifyCustomer: raw.notifyCustomer !== false,
      whatsapp: String(raw.whatsapp ?? DEFAULT_EMAIL_SETTINGS.whatsapp).trim().slice(0, 40),
    };
  } catch {
    return null;
  }
}

/** Configuração efetiva usada no envio (painel primeiro, depois variáveis). */
export async function getEmailSettings(): Promise<{ settings: EmailSettings; source: "panel" | "env" | "none" }> {
  const stored = await readStored();
  if (stored) {
    const { passwordEnc, ...rest } = stored;
    return { settings: { ...rest, password: decrypt(passwordEnc) }, source: "panel" };
  }
  const env = fromEnv();
  if (env) return { settings: env, source: "env" };
  return { settings: DEFAULT_EMAIL_SETTINGS, source: "none" };
}

export async function getPublicEmailSettings(): Promise<PublicEmailSettings> {
  const { settings, source } = await getEmailSettings();
  const { password, ...rest } = settings;
  return { ...rest, hasPassword: Boolean(password), source };
}

/** Valida e grava. Senha em branco mantém a senha já salva. */
export async function saveEmailSettings(raw: Record<string, unknown>): Promise<PublicEmailSettings> {
  const current = await readStored();
  const port = Math.trunc(Number(raw.port));
  const next = {
    enabled: raw.enabled === true,
    host: String(raw.host ?? "").trim().slice(0, 200),
    port: port >= 1 && port <= 65535 ? port : 587,
    security: raw.security === "ssl" ? "ssl" : "starttls",
    user: String(raw.user ?? "").trim().slice(0, 200),
    fromName: String(raw.fromName ?? "").trim().slice(0, 80) || DEFAULT_EMAIL_SETTINGS.fromName,
    fromEmail: String(raw.fromEmail ?? "").trim().toLowerCase(),
    replyTo: String(raw.replyTo ?? "").trim().toLowerCase(),
    leadRecipients: recipients(raw.leadRecipients),
    notifyCustomer: raw.notifyCustomer !== false,
    whatsapp: String(raw.whatsapp ?? "").trim().slice(0, 40) || DEFAULT_EMAIL_SETTINGS.whatsapp,
  };
  const newPassword = String(raw.password ?? "");
  const passwordEnc = raw.clearPassword === true ? "" : newPassword ? encrypt(newPassword) : current?.passwordEnc ?? "";

  if (next.fromEmail && !isEmail(next.fromEmail)) throw new Error("E-mail de envio inválido.");
  if (next.replyTo && !isEmail(next.replyTo)) throw new Error("E-mail de resposta inválido.");
  if (next.enabled) {
    if (!next.host || !next.user || !passwordEnc) throw new Error("Para ativar, preencha servidor, usuário e senha do SMTP.");
    if (!next.fromEmail) throw new Error("Para ativar, informe o e-mail de envio (ex.: naoresponda@seudominio.com.br).");
    if (!next.leadRecipients.length) throw new Error("Para ativar, informe ao menos um e-mail que recebe os leads.");
  }

  await query(
    `INSERT INTO app_settings(key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`,
    [SETTING_KEY, JSON.stringify({ ...next, passwordEnc })],
  );
  return getPublicEmailSettings();
}
