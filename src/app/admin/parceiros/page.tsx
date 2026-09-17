import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { listPartners } from "@/lib/partners";
import { PartnersAdmin } from "@/components/PartnersAdmin";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  if (!(await currentSession())) redirect("/admin/login");

  let partners: Awaited<ReturnType<typeof listPartners>> = [];
  let failure = "";
  try {
    partners = await listPartners();
  } catch (error) {
    // Banco sem a migration 012 mostra um aviso claro em vez de página quebrada.
    failure = error instanceof Error ? error.message : "Erro desconhecido ao carregar parceiros.";
  }

  if (failure) {
    return (
      <>
        <div className="adm-header">
          <h1>Parceiros</h1>
        </div>
        <div className="adm-card">
          <p className="adm-feedback error">
            Não foi possível carregar os parceiros: {failure}
          </p>
          <p>
            Se a mensagem citar colunas que não existem, rode <code>npm run db:migrate</code> para
            aplicar a migration <code>012_pricing_internal_code_availability.sql</code>.
          </p>
        </div>
      </>
    );
  }

  return <PartnersAdmin partners={partners} />;
}
