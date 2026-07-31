import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { currentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  return <section className="shell admin-shell"><div className="content-grid"><div className="prose"><p className="eyebrow dark">Segurança da conta</p><h2>Primeiro acesso</h2><p>A senha temporária deve ser substituída antes de usar as funções administrativas.</p></div><ChangePasswordForm /></div></section>;
}
