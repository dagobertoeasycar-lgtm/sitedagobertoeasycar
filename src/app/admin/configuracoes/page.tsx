import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");

  return (
    <>
      <div className="adm-header"><h1>Configurações</h1></div>
      <div className="adm-grid-2">
        <Link className="adm-card config-link-card" href="/admin/configuracoes/integracoes/meta">
          <span className="config-link-icon">🛒</span><div><h2>Integrações → Catálogo Meta</h2><p>Feed automático do estoque para o catálogo conectado ao WhatsApp Business.</p></div>
        </Link>
        <Link className="adm-card config-link-card" href="/admin/trocar-senha">
          <span className="config-link-icon">🔐</span><div><h2>Trocar senha</h2><p>Atualize com segurança a senha da sua conta administrativa.</p></div>
        </Link>
      </div>
    </>
  );
}
