import Link from "next/link";
import { money, vehicleOriginBadgeLabel, vehiclePublicLocation, type Vehicle } from "@/lib/vehicles";
import { MetaTrackedAnchor } from "@/components/MetaPixelEvents";
import { Gauge, MapPin, MessageCircle } from "lucide-react";
import { VehicleImage } from "@/components/VehicleImage";

export function VehicleCard({ vehicle, index = 0 }: { vehicle: Vehicle; index?: number }) {
  const imgSrc = vehicle.image_url || "/em-breve.jpg";
  const isExternal = imgSrc.startsWith("http");
  const originLabel = vehicleOriginBadgeLabel(vehicle);
  const version = vehicle.version?.trim();
  const subtitle = [version && version.toLowerCase() !== vehicle.title.trim().toLowerCase() ? version : "", vehicle.fuel, vehicle.transmission].filter(Boolean).join(" · ");
  const pixelParameters = {
    content_ids: [vehicle.catalog_item_id], content_type: "product", content_name: vehicle.title,
    value: vehicle.price_cents / 100, currency: "BRL", marca: vehicle.brand, modelo: vehicle.model,
    ano: vehicle.year_model || vehicle.year_make, origem: originLabel,
  };

  return (
    <article className="vehicle-card">
      <Link href={`/veiculos/${vehicle.slug}`} className="vehicle-image">
        <VehicleImage src={imgSrc} alt={vehicle.title} loading={isExternal && index < 6 ? "eager" : "lazy"} />
        <span className="vehicle-origin-tag">{originLabel}</span>
        <span className="vehicle-year-badge">{vehicle.year_make}/{vehicle.year_model}</span>
      </Link>
      <div className="vehicle-content">
        <div className="badges">
          {vehicle.featured && <span>Destaque</span>}
          <span>Periciado</span>
          {vehicle.promotion && <span>Promoção</span>}
        </div>
        <h2><Link href={`/veiculos/${vehicle.slug}`} title={vehicle.title}>{vehicle.title}</Link></h2>
        <p title={subtitle}>{subtitle}</p>
        {vehicle.old_price_cents && vehicle.old_price_cents > vehicle.price_cents ? (
          <div>
            <span style={{ textDecoration: "line-through", color: "#64748b", fontSize: "0.85rem" }}>{money(vehicle.old_price_cents)}</span>
            <strong className="price">{money(vehicle.price_cents)}</strong>
          </div>
        ) : (
          <strong className="price">{money(vehicle.price_cents)}</strong>
        )}
        <div className="vehicle-meta">
          <span><Gauge size={15} aria-hidden="true" />{vehicle.mileage.toLocaleString("pt-BR")} km</span>
          <span><MapPin size={15} aria-hidden="true" />{vehiclePublicLocation(vehicle)}</span>
        </div>
        <div className="card-actions">
          <Link className="button button-outline" href={`/veiculos/${vehicle.slug}`}>Detalhes</Link>
          <MetaTrackedAnchor className="button button-dark" href={`https://wa.me/5511934718276?text=${encodeURIComponent(`Olá! Tenho interesse no ${vehicle.title} (${vehicle.catalog_item_id}). Vi no site da Autodrive e quero mais informações.`)}`} target="_blank" rel="noreferrer" eventName="Contact" eventParameters={pixelParameters}><MessageCircle size={16} aria-hidden="true" />Contato</MetaTrackedAnchor>
        </div>
      </div>
    </article>
  );
}
