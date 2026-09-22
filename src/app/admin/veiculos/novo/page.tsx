import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { AdminVehicleForm } from "@/components/AdminVehicleForm";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  if (!(await currentSession())) redirect("/admin/login");
  return (
    <>
      <div className="adm-header"><h1>Novo anúncio</h1></div>
      <section className="adm-card"><AdminVehicleForm /></section>
    </>
  );
}
