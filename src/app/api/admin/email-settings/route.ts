import { NextRequest, NextResponse } from "next/server";
import { apiArea } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getEmailSettings, getPublicEmailSettings, isEmail, saveEmailSettings, type EmailSettings } from "@/lib/email-settings";
import { sendTestEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiArea("configuracoes");
  if (guard.error) return guard.error;
  return NextResponse.json(await getPublicEmailSettings());
}

/** Salva a configuração (action=save) ou envia um teste com o que está na tela (action=test). */
export async function POST(request: NextRequest) {
  const guard = await apiArea("configuracoes");
  if (guard.error) return guard.error;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  if (body.action === "test") {
    const to = String(body.testTo ?? "").trim();
    if (!isEmail(to)) return NextResponse.json({ error: "Informe um e-mail válido para o teste." }, { status: 400 });
    const { settings: saved } = await getEmailSettings();
    const port = Math.trunc(Number(body.port));
    const settings: EmailSettings = {
      ...saved,
      host: String(body.host ?? saved.host).trim(),
      port: port >= 1 && port <= 65535 ? port : saved.port,
      security: body.security === "ssl" ? "ssl" : "starttls",
      user: String(body.user ?? saved.user).trim(),
      password: String(body.password ?? "") || saved.password,
      fromName: String(body.fromName ?? saved.fromName).trim() || saved.fromName,
      fromEmail: String(body.fromEmail ?? saved.fromEmail).trim(),
      leadRecipients: String(body.leadRecipients ?? "").split(/[,;\n]/).map((item) => item.trim()).filter(isEmail),
    };
    if (!settings.host || !settings.user || !settings.password || !isEmail(settings.fromEmail)) {
      return NextResponse.json({ error: "Preencha servidor, usuário, senha e e-mail de envio antes de testar." }, { status: 400 });
    }
    const result = await sendTestEmail(settings, to);
    await audit(guard.user.id, "test", "settings", "email_settings", { to, ok: result.ok }, request);
    if (!result.ok) return NextResponse.json({ error: `Falha no envio: ${result.error}` }, { status: 502 });
    return NextResponse.json({ ok: true });
  }

  try {
    const saved = await saveEmailSettings(body);
    await audit(guard.user.id, "update", "settings", "email_settings", {
      enabled: saved.enabled, host: saved.host, port: saved.port, fromEmail: saved.fromEmail,
      leadRecipients: saved.leadRecipients, notifyCustomer: saved.notifyCustomer, passwordChanged: Boolean(body.password) || body.clearPassword === true,
    }, request);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 });
  }
}
