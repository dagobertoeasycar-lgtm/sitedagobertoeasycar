import { redirect } from "next/navigation";
import Link from "next/link";
import { currentSession } from "@/lib/auth";
import { getPricingRule, getStockRule } from "@/lib/settings";
import { PricingRuleForm } from "@/components/PricingRuleForm";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  if (!(await currentSession())) redirect("/admin/login");

  const [pricing, stock] = await Promise.all([getPricingRule(), getStockRule()]);

  return (
    <>
      <div className="adm-header">
        <div>
          <h1>Regra de preço</h1>
          <p className="adm-header-description">
            Margem comercial aplicada sobre o preço de origem antes de publicar no site, no catálogo e no WhatsApp.
          </p>
        </div>
        <div className="adm-header-actions">
          <Link className="adm-link" href="/admin/configuracoes">← Configurações</Link>
        </div>
      </div>
      <div className="adm-card">
        <PricingRuleForm pricing={pricing} stock={stock} />
      </div>
    </>
  );
}
