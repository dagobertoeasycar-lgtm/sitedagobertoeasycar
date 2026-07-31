import { notFound } from "next/navigation";
import { VehicleGallery } from "@/components/VehicleGallery";
import { findVehicle, money } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export default async function VehiclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await findVehicle(slug).catch(() => null);
  if (!vehicle) notFound();
  const message = encodeURIComponent(`Olá! Tenho interesse no ${vehicle.title}. Gostaria de mais informações.`);
  const images: string[] = Array.isArray(vehicle.images) ? vehicle.images : [];
  const options: string[] = Array.isArray(vehicle.options) ? vehicle.options : [];
  
  return (
    <section className="shell section vehicle-detail">
      <VehicleGallery
        images={images}
        title={vehicle.title}
        fallback={vehicle.image_url || "/vehicles/car-1.avif"}
      />
      <div>
        <div className="badges">
          {vehicle.featured && <span>Destaque</span>}
          <span>Periciado</span>
          {vehicle.promotion && <span>Promoção</span>}
        </div>
        <h1>{vehicle.title}</h1>
        {vehicle.old_price_cents && vehicle.old_price_cents > vehicle.price_cents ? (
          <div>
            <span style={{ textDecoration: "line-through", color: "#94a3b8", fontSize: "1rem", marginRight: "0.5rem" }}>
              {money(vehicle.old_price_cents)}
            </span>
            <strong className="price">{money(vehicle.price_cents)}</strong>
          </div>
        ) : (
          <strong className="price">{money(vehicle.price_cents)}</strong>
        )}
        <div className="detail-list">
          <div><span>Ano</span><strong>{vehicle.year_make}/{vehicle.year_model}</strong></div>
          <div><span>Quilometragem</span><strong>{vehicle.mileage.toLocaleString("pt-BR")} km</strong></div>
          <div><span>Combustível</span><strong>{vehicle.fuel || "Consulte"}</strong></div>
          <div><span>Câmbio</span><strong>{vehicle.transmission || "Consulte"}</strong></div>
          <div><span>Carroceria</span><strong>{vehicle.body_type || "Consulte"}</strong></div>
          {vehicle.color && <div><span>Cor</span><strong>{vehicle.color}</strong></div>}
          {vehicle.doors > 0 && <div><span>Portas</span><strong>{vehicle.doors}</strong></div>}
          <div><span>Localização</span><strong>{vehicle.city}</strong></div>
        </div>
        {vehicle.store && <p className="vehicle-store">Loja: {vehicle.store}</p>}
        {options.length > 0 && (
          <>
            <h3>Opcionais</h3>
            <div className="vehicle-options">
              {options.map((opt, i) => <span key={i}>{opt}</span>)}
            </div>
          </>
        )}
        <p>{vehicle.description || "Veículo selecionado com procedência e atendimento especializado."}</p>
        <a className="button" href={`https://wa.me/5511934718276?text=${message}`} target="_blank" rel="noreferrer">
          Tenho interesse neste veículo
        </a>
        <p><small>Crédito sujeito à análise e aprovação das instituições financeiras. Consulte condições.</small></p>
      </div>
    </section>
  );
}
