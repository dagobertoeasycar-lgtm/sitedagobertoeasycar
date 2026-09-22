import { requireArea } from "@/lib/permissions";
import { SyncPanel } from "@/components/SyncPanel";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  await requireArea("importacoes");

  return (
    <>
      <div className="adm-header"><h1>Sincronização</h1></div>
      <SyncPanel />
    </>
  );
}
