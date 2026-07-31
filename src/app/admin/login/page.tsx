import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await currentSession()) redirect("/admin");
  const { erro } = await searchParams;
  return <section className="shell admin-shell"><form className="lead-form" action="/api/auth/login" method="post" style={{ maxWidth: 480, margin: "0 auto" }}><h1>Acesso administrativo</h1><p>Use sua conta individual. As sessões expiram após oito horas.</p><label>E-mail<input type="email" name="email" required autoComplete="username" /></label><label>Senha<input type="password" name="password" required autoComplete="current-password" /></label>{erro && <p className="form-status error">E-mail ou senha inválidos.</p>}<button className="button">Entrar</button></form></section>;
}
