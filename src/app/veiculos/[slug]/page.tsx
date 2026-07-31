import Image from "next/image";
import { notFound } from "next/navigation";
import { findVehicle, money } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await findVehicle(slug).catch(() => null);
  if (!vehicle) notFound();
  const message = encodeURIComponent(`Olá! Tenho interesse no ${vehicle.title}. Gostaria de mais informações.`);
  return (
    <section className="shell section vehicle-detail">
      <div className="vehicle-detail-image"><Image src={vehicle.image_url || "/vehicles/car-1.avif"} alt={vehicle.title} fill priority sizes="(max-width: 760px) 100vw, 60vw" /></div>
      <div>
        <div className="badges">{vehicle.featured && <span>Destaque</span>}<span>Periciado</span>{vehicle.promotion && <span>Promoção</span>}</div>
        <h1>{vehicle.title}</h1>
        <strong className="price">{money(vehicle.price_cents)}</strong>
        <div className="detail-list">
          <div><span>Ano</span><strong>{vehicle.year_make}/{vehicle.year_model}</strong></div>
          <div><span>Quilometragem</span><strong>{vehicle.mileage.toLocaleString("pt-BR")} km</strong></div>
          <div><span>Combustível</span><strong>{vehicle.fuel}</strong></div>
          <div><span>Câmbio</span><strong>{vehicle.transmission}</strong></div>
          <div><span>Carroceria</span><strong>{vehicle.body_type || "Consulte"}</strong></div>
          <div><span>Localização</span><strong>{vehicle.city}</strong></div>
        </div>
        <p>{vehicle.description || "Veículo selecionado com procedência e atendimento especializado."}</p>
        <a className="button" href={`https://wa.me/5511934718276?text=${message}`} target="_blank" rel="noreferrer">Tenho interesse neste veículo</a>
        <p><small>Crédito sujeito à análise e aprovação das instituições financeiras. Consulte condições.</small></p>
      </div>
    </section>
  );
}
