import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

const root = path.resolve(import.meta.dirname, "..");
const environmentFile = path.join(root, ".env.production");
const settings = {};
for (const line of (await readFile(environmentFile, "utf8")).split(/\r?\n/)) {
  const separator = line.indexOf("=");
  if (separator > 0 && !line.trimStart().startsWith("#")) settings[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
}
const host = settings.SMTP_HOST;
const port = Number(settings.SMTP_PORT ?? "587");
const user = settings.SMTP_USER;
const password = settings.SMTP_PASSWORD;
const from = settings.SMTP_FROM;
const to = settings.ADMIN_EMAIL;
if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from || !to) throw new Error("Configuração SMTP incompleta");

const secure = port === 465;
const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  requireTLS: !secure,
  auth: { user, pass: password },
  connectionTimeout: 8_000,
  greetingTimeout: 8_000,
  socketTimeout: 15_000,
  disableFileAccess: true,
  disableUrlAccess: true,
  tls: { minVersion: "TLSv1.2", servername: host },
});

await transport.verify();
console.log(`OK SMTP verificado em ${host}:${port} com TLS`);
if (process.argv.includes("--send")) {
  const info = await transport.sendMail({
    from,
    to,
    subject: "[Dagoberto Easycar] Teste de SMTP",
    text: `Teste de entrega SMTP concluído em ${new Date().toISOString()}.`,
  });
  console.log(`OK mensagem de teste aceita pelo servidor id=${info.messageId}`);
}
transport.close();
