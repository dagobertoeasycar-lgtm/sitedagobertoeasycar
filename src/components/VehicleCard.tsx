import Link from "next/link";
import { CalendarDays, Gauge } from "lucide-react";
import { money, type Vehicle } from "@/lib/vehicles";
import { VehicleImage } from "@/components/VehicleImage";

const BRAND_MARKS: Record<string, string> = {
  volkswagen: "VW", chevrolet: "GM", "mercedes-benz": "MB", mercedes: "MB", "land rover": "LR", "alfa romeo": "AR",
  bmw: "BMW", audi: "AUDI", fiat: "FIAT", ford: "FORD", jeep: "JEEP", kia: "KIA", ram: "RAM", byd: "BYD", gwm: "GWM",
  mini: "MINI", volvo: "VOLVO", honda: "H", hyundai: "H", toyota: "T", nissan: "N", renault: "R", peugeot: "P",
  citroen: "C", "citroën": "C", mitsubishi: "M", suzuki: "S", chery: "C", "caoa chery": "C", jac: "JAC", porsche: "P", yamaha: "Y",
};

function titleCase(value: string) {
  return value.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

/** Marca/modelo em caixa alta vinda das integrações fica em formato de título. */
function tidy(value: string) {
  const clean = value.trim();
  if (clean.length > 3 && clean === clean.toUpperCase() && /\p{L}{4,}/u.test(clean)) return titleCase(clean);
  return clean;
}

function brandMark(brand: string) {
  const key = brand.trim().toLowerCase();
  return BRAND_MARKS[key] ?? key.replace(/[^\p{L}]/gu, "").slice(0, 2).toUpperCase();
}

function cardBadge(vehicle: Vehicle) {
  if (vehicle.promotion) return { label: "Oportunidade", tone: "hot" };
  if (vehicle.featured) return { label: "Destaque", tone: "brand" };
  if (vehicle.price_cents >= 15_000_000) return { label: "Premium", tone: "dark" };
  const year = vehicle.year_model || vehicle.year_make;
  if (year && year >= new Date().getFullYear() - 1) return { label: "Seminovo", tone: "brand" };
  return { label: "Periciado", tone: "dark" };
}

export function VehicleCard({ vehicle, index = 0 }: { vehicle: Vehicle; index?: number }) {
  const imgSrc = vehicle.image_url || "/em-breve.png";
  const isExternal = imgSrc.startsWith("http");
  const href = `/veiculos/${vehicle.slug}`;
  const brand = tidy(vehicle.brand || "");
  const model = tidy(vehicle.model || "");
  const heading = [brand, model].filter(Boolean).join(" ") || vehicle.title;
  const version = vehicle.version?.trim() || vehicle.title;
  const badge = cardBadge(vehicle);
  const hasOldPrice = Boolean(vehicle.old_price_cents && vehicle.old_price_cents > vehicle.price_cents);

  return (
    <article className="vehicle-card vcard">
      <Link href={href} className="vehicle-image vcard-image" aria-label={`Ver ${vehicle.title}`}>
        <VehicleImage src={imgSrc} alt={vehicle.title} loading={isExternal && index < 6 ? "eager" : "lazy"} />
        <span className={`vcard-badge ${badge.tone}`}>{badge.label}</span>
      </Link>
      <div className="vcard-body">
        <div className="vcard-head">
          <span className="vcard-logo" aria-hidden="true">{brandMark(vehicle.brand || heading)}</span>
          <h2><Link href={href} title={vehicle.title}>{heading}</Link></h2>
        </div>
        <p className="vcard-version" title={version}>{version}</p>
        <div className="vcard-meta">
          <span><CalendarDays size={14} aria-hidden="true" />{vehicle.year_make}/{vehicle.year_model}</span>
          <span><Gauge size={14} aria-hidden="true" />{vehicle.mileage.toLocaleString("pt-BR")} km</span>
        </div>
        <div className="vcard-foot">
          <div className="vcard-price">
            {hasOldPrice && <span className="vcard-old">de {money(vehicle.old_price_cents!)}</span>}
            <strong>{hasOldPrice && <small>por</small>}{money(vehicle.price_cents)}</strong>
          </div>
          <Link href={href} className="vcard-more">Ver mais</Link>
        </div>
      </div>
    </article>
  );
}
