import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { MetaCatalogPanel } from "@/components/MetaCatalogPanel";

export const dynamic = "force-dynamic";

export default async function MetaCatalogPage() {
  if (!(await currentSession())) redirect("/admin/login");
  return (
    <>
      <div className="adm-header">
        <div><p className="meta-breadcrumb">Configurações → Integrações</p><h1>Catálogo Meta</h1></div>
      </div>
      <MetaCatalogPanel />
    </>
  );
}

