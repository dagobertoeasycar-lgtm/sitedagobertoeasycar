import type { Metadata } from "next";
import { VehicleCard } from "@/components/VehicleCard";
import { listVehicles } from "@/lib/vehicles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Veículos", description: "Consulte carros usados e seminovos periciados em Osasco." };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const vehicles = await listVehicles(q).catch(() => []);
  return (
    <>
      <section className="page-hero"><div className="shell"><p className="eyebrow">Estoque Dagoberto Easycar</p><h1>Encontre seu próximo veículo</h1><p>Use a busca e fale com nossa equipe para confirmar disponibilidade, condições e agendar uma visita.</p></div></section>
      <section className="shell section">
        <div className="filters"><form><input name="q" defaultValue={q} aria-label="Buscar veículo" placeholder="Marca, modelo ou palavra-chave" /><button className="button">Buscar</button></form></div>
        {vehicles.length ? <div className="vehicle-grid">{vehicles.map((vehicle, index) => <VehicleCard key={vehicle.id} vehicle={vehicle} index={index} />)}</div> : <div className="empty-state"><h2>Nenhum veículo publicado</h2><p>{q ? "Tente uma busca diferente ou consulte a equipe." : "O estoque está sendo atualizado pelo painel administrativo."}</p><a className="button" href="https://wa.me/5511934718276">Consultar opções</a></div>}
      </section>
    </>
  );
}
