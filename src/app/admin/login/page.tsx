import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { defaultSessionTimeoutSettings, formatSessionDuration, readSessionTimeoutSettings } from "@/lib/session-settings";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; expirou?: string }> }) {
  if (await currentSession()) redirect("/admin");
  const [{ erro, expirou }, settings] = await Promise.all([
    searchParams,
    readSessionTimeoutSettings().catch(() => defaultSessionTimeoutSettings),
  ]);
  const sessionText = settings.enabled
    ? `Por segurança, a sessão encerra após ${formatSessionDuration(settings.minutes)} sem atividade.`
    : "O encerramento automático está desativado. Use Sair ao terminar.";
  return <section className="shell admin-shell"><form className="lead-form" action="/api/auth/login" method="post" style={{ maxWidth: 480, margin: "0 auto" }}><h1>Acesso administrativo</h1><p>Use sua conta individual. {sessionText}</p><label>E-mail<input type="email" name="email" required autoComplete="username" /></label><label>Senha<input type="password" name="password" required autoComplete="current-password" /></label>{expirou && <p className="form-status error">Sua sessão foi encerrada por falta de atividade. Entre novamente.</p>}{erro && <p className="form-status error">E-mail ou senha inválidos.</p>}<button className="button">Entrar</button></form></section>;
}
