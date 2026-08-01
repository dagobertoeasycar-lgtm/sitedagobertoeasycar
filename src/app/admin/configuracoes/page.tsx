import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");

  return (
    <>
      <div className="adm-header"><h1>Configurações</h1></div>
      <div className="adm-card" style={{ padding: 30, textAlign: "center", color: "#64748b" }}>
        <p>Configurações gerais do sistema em desenvolvimento.</p>
        <p>Para alterar senha, acesse <a href="/admin/trocar-senha" style={{ color: "#0a4da2", fontWeight: 700 }}>Trocar Senha</a>.</p>
      </div>
    </>
  );
}
