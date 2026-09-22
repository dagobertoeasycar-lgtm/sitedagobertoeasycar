import { requireArea } from "@/lib/permissions";
import { AdminVehicleForm } from "@/components/AdminVehicleForm";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  await requireArea("veiculos");
  return (
    <>
      <div className="adm-header"><h1>Novo anúncio</h1></div>
      <section className="adm-card"><AdminVehicleForm /></section>
    </>
  );
}
