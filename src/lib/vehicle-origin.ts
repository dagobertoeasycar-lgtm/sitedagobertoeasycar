export type VehicleOriginType = "OWN" | "PARTNER" | "PRIVATE";

type VehicleOriginInput = {
  origin_type?: string | null;
  source_id?: string | null;
  store?: string | null;
  city?: string | null;
};

const ORIGIN_FILTERS: Record<string, VehicleOriginType> = {
  own: "OWN",
  autodrive: "OWN",
  auto_drive: "OWN",
  estoque: "OWN",
  partner: "PARTNER",
  partners: "PARTNER",
  parceiros: "PARTNER",
  lojista: "PARTNER",
  lojistas: "PARTNER",
  private: "PRIVATE",
  particulares: "PRIVATE",
  particular: "PRIVATE",
};

export const VEHICLE_ORIGIN_OPTIONS = [
  { value: "autodrive", label: "Autodrive" },
  { value: "parceiros", label: "Lojistas parceiros" },
  { value: "particulares", label: "Particulares" },
] as const;

export function normalizeVehicleOrigin(value?: string | null): VehicleOriginType | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw === "OWN" || raw === "PARTNER" || raw === "PRIVATE") return raw;
  return ORIGIN_FILTERS[raw.toLowerCase()] ?? null;
}

export function resolveVehicleOrigin(vehicle: VehicleOriginInput): VehicleOriginType {
  const origin = normalizeVehicleOrigin(vehicle.origin_type);
  if (origin) return origin;
  if (vehicle.source_id === "easycar_scraper" || vehicle.store) return "PARTNER";
  return "OWN";
}

export function vehicleOriginBadgeLabel(vehicle: VehicleOriginInput) {
  const origin = resolveVehicleOrigin(vehicle);
  if (origin === "OWN") return "ESTOQUE AUTODRIVE";
  if (origin === "PRIVATE") return "PARTICULAR";
  return "LOJISTA PARCEIRO";
}

export function vehicleOriginPublicLabel(vehicle: VehicleOriginInput) {
  const origin = resolveVehicleOrigin(vehicle);
  if (origin === "OWN") return "Estoque Autodrive";
  if (origin === "PRIVATE") return "Particular intermediado";
  return "Lojista parceiro";
}

export function vehiclePublicLocation(vehicle: VehicleOriginInput) {
  const city = String(vehicle.city || "").trim();
  const origin = resolveVehicleOrigin(vehicle);
  if (origin === "OWN") return city ? `Estoque Autodrive - ${city}` : "Estoque Autodrive";
  if (origin === "PRIVATE") return city ? `Particular intermediado - ${city}` : "Particular intermediado";
  return city ? `Parceiro Autodrive - ${city}` : "Disponível em parceiro Autodrive";
}
