import { requireArea } from "@/lib/permissions";
import { MetaCatalogPanel } from "@/components/MetaCatalogPanel";

export const dynamic = "force-dynamic";

export default async function MetaCatalogPage() {
  await requireArea("meta");
  return (
    <>
      <div className="adm-header">
        <div><p className="meta-breadcrumb">Configurações → Integrações</p><h1>Catálogo Meta</h1></div>
      </div>
      <MetaCatalogPanel />
    </>
  );
}

