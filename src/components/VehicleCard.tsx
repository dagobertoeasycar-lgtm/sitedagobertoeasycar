import Image from "next/image";
import Link from "next/link";
import { money, type Vehicle } from "@/lib/vehicles";

export function VehicleCard({ vehicle, index = 0 }: { vehicle: Vehicle; index?: number }) {
  const fallback = `/vehicles/car-${(index % 4) + 1}.avif`;
  return (
    <article className="vehicle-card">
      <Link href={`/veiculos/${vehicle.slug}`} className="vehicle-image">
        <Image src={vehicle.image_url || fallback} alt={vehicle.title} fill sizes="(max-width: 760px) 100vw, 33vw" />
        <span>{vehicle.year_make}/{vehicle.year_model}</span>
      </Link>
      <div className="vehicle-content">
        <div className="badges">{vehicle.featured && <span>Destaque</span>}<span>Periciado</span>{vehicle.promotion && <span>Promoção</span>}</div>
        <h2><Link href={`/veiculos/${vehicle.slug}`}>{vehicle.title}</Link></h2>
        <p>{vehicle.version} · {vehicle.fuel} · {vehicle.transmission}</p>
        {vehicle.old_price_cents && vehicle.old_price_cents > vehicle.price_cents ? (
          <div>
            <span style={{ textDecoration: "line-through", color: "#94a3b8", fontSize: "0.85rem" }}>{money(vehicle.old_price_cents)}</span>
            <strong className="price">{money(vehicle.price_cents)}</strong>
          </div>
        ) : (
          <strong className="price">{money(vehicle.price_cents)}</strong>
        )}
        <div className="vehicle-meta"><span>{vehicle.mileage.toLocaleString("pt-BR")} km</span><span>{vehicle.city}</span></div>
        <div className="card-actions">
          <Link className="button button-outline" href={`/veiculos/${vehicle.slug}`}>Detalhes</Link>
          <a className="button" href={`https://wa.me/5511934718276?text=${encodeURIComponent(`Olá! Tenho interesse no ${vehicle.title}.`)}`} target="_blank" rel="noreferrer">Contato</a>
        </div>
      </div>
    </article>
  );
}
