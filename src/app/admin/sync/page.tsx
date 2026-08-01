import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { SyncPanel } from "@/components/SyncPanel";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");

  return (
    <>
      <div className="adm-header"><h1>Sincronização</h1></div>
      <SyncPanel />
    </>
  );
}
