export const META_FEED_ORIGIN = "https://www.dagobertoeasycar.com.br";

export const META_FEED_HEADERS = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "model",
  "version",
  "year",
  "mileage",
  "transmission",
  "fuel_type",
  "body_style",
  "color",
  "city",
  "state",
] as const;

export type MetaAvailability = "in stock" | "out of stock" | "available for order" | "discontinued" | "exclude";
export type StockStatus = "available" | "reserved" | "sold";

export type MetaFeedSettings = {
  availabilityPublished: MetaAvailability;
  availabilityReserved: MetaAvailability;
  availabilitySold: MetaAvailability;
  defaultImageUrl: string;
  includeWithoutImages: boolean;
  catalogId: string;
  businessPortfolio: string;
  whatsappAccount: string;
  facebookPage: string;
  phoneNumber: string;
  dataSourceId: string;
  lastImportStatus: string;
  lastImportAt: string;
};

export const DEFAULT_META_FEED_SETTINGS: MetaFeedSettings = {
  availabilityPublished: "in stock",
  availabilityReserved: "out of stock",
  availabilitySold: "exclude",
  defaultImageUrl: `${META_FEED_ORIGIN}/em-breve.jpg`,
  includeWithoutImages: false,
  catalogId: "",
  businessPortfolio: "",
  whatsappAccount: "",
  facebookPage: "",
  phoneNumber: "+55 11 93471-8276",
  dataSourceId: "",
  lastImportStatus: "",
  lastImportAt: "",
};

export type MetaFeedVehicle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  stock_status?: string | null;
  price_cents: number;
  image_url: string | null;
  images: unknown;
  brand: string;
  model: string;
  version: string;
  year_make: number;
  year_model: number;
  mileage: number;
  transmission: string;
  fuel: string;
  body_type: string;
  color: string;
  city: string;
  updated_at?: Date | string;
};

export type MetaFeedIssue = {
  id: string;
  title: string;
  code: string;
  message: string;
};

export type MetaFeedItem = Record<(typeof META_FEED_HEADERS)[number], string>;

export type MetaFeedResult = {
  csv: string;
  items: MetaFeedItem[];
  issues: MetaFeedIssue[];
  generatedAt: string;
  total: number;
  exported: number;
  ignored: number;
  errors: number;
};

const AVAILABILITIES = new Set<MetaAvailability>(["in stock", "out of stock", "available for order", "discontinued", "exclude"]);

export function normalizeAvailability(value: unknown, fallback: MetaAvailability): MetaAvailability {
  const normalized = String(value ?? "").trim().toLowerCase() as MetaAvailability;
  return AVAILABILITIES.has(normalized) ? normalized : fallback;
}

export function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function toCsv(items: MetaFeedItem[]): string {
  const header = META_FEED_HEADERS.map(csvCell).join(",");
  const rows = items.map(item => META_FEED_HEADERS.map(field => csvCell(item[field])).join(","));
  return [header, ...rows].join("\r\n") + "\r\n";
}

export function publicHttpsUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || /^[a-z]:[\\/]/i.test(raw) || raw.startsWith("\\\\")) return null;
  try {
    const url = new URL(raw, META_FEED_ORIGIN);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function imageCandidates(vehicle: MetaFeedVehicle): string[] {
  const candidates: unknown[] = [vehicle.image_url];
  if (Array.isArray(vehicle.images)) {
    for (const media of vehicle.images) {
      if (typeof media === "string") candidates.push(media);
      else if (media && typeof media === "object") {
        const item = media as { type?: unknown; url?: unknown };
        if (String(item.type ?? "image").toLowerCase() !== "video") candidates.push(item.url);
      }
    }
  }
  const result: string[] = [];
  for (const candidate of candidates) {
    const url = publicHttpsUrl(candidate);
    if (url && !result.includes(url)) result.push(url);
  }
  return result;
}

function locationParts(value: string): { city: string; state: string } {
  const raw = String(value ?? "").trim();
  const parts = raw.split("/").map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /^[A-Za-z]{2}$/.test(parts.at(-1) ?? "")) {
    return { city: parts.slice(0, -1).join("/"), state: (parts.at(-1) ?? "").toUpperCase() };
  }
  return { city: raw || "Osasco", state: "SP" };
}

function availabilityFor(vehicle: MetaFeedVehicle, settings: MetaFeedSettings): MetaAvailability {
  const stock = String(vehicle.stock_status ?? "available") as StockStatus;
  if (stock === "reserved") return settings.availabilityReserved;
  if (stock === "sold") return settings.availabilitySold;
  return settings.availabilityPublished;
}

function generatedDescription(vehicle: MetaFeedVehicle): string {
  const details = [
    vehicle.version,
    `${vehicle.year_make}/${vehicle.year_model}`,
    `${Math.max(0, Number(vehicle.mileage) || 0)} km`,
    vehicle.transmission,
    vehicle.fuel,
    vehicle.body_type,
    vehicle.color,
    vehicle.city,
  ].map(value => String(value ?? "").trim()).filter(Boolean);
  const original = String(vehicle.description ?? "").replace(/\0/g, "").trim();
  return [original || vehicle.title, details.join(" · ")].filter(Boolean).join("\n").slice(0, 5000);
}

function issue(vehicle: MetaFeedVehicle, code: string, message: string): MetaFeedIssue {
  return { id: vehicle.id, title: vehicle.title || "Sem título", code, message };
}

export function buildMetaFeed(
  vehicles: MetaFeedVehicle[],
  settings: MetaFeedSettings = DEFAULT_META_FEED_SETTINGS,
  now = new Date(),
): MetaFeedResult {
  const items: MetaFeedItem[] = [];
  const issues: MetaFeedIssue[] = [];

  for (const vehicle of vehicles) {
    if (vehicle.status !== "published") {
      issues.push(issue(vehicle, "not_published", "Veículo não publicado"));
      continue;
    }

    const availability = availabilityFor(vehicle, settings);
    if (availability === "exclude") {
      issues.push(issue(vehicle, "availability_excluded", "Estado de estoque configurado para exclusão"));
      continue;
    }

    const title = String(vehicle.title ?? "").trim();
    const slug = String(vehicle.slug ?? "").trim();
    const priceCents = Number(vehicle.price_cents);
    if (!title) { issues.push(issue(vehicle, "missing_title", "Título obrigatório ausente")); continue; }
    if (!slug) { issues.push(issue(vehicle, "missing_link", "Slug do anúncio ausente")); continue; }
    if (!Number.isInteger(priceCents) || priceCents <= 0) { issues.push(issue(vehicle, "invalid_price", "Preço deve ser maior que zero")); continue; }

    const link = publicHttpsUrl(`/veiculos/${encodeURIComponent(slug)}`);
    if (!link) { issues.push(issue(vehicle, "invalid_link", "Link público inválido")); continue; }

    const images = imageCandidates(vehicle);
    if (!images.length && settings.includeWithoutImages) {
      const fallback = publicHttpsUrl(settings.defaultImageUrl);
      if (fallback) images.push(fallback);
    }
    if (!images.length) {
      issues.push(issue(vehicle, "missing_image", "Nenhuma imagem HTTPS pública válida"));
      continue;
    }

    const location = locationParts(vehicle.city);
    items.push({
      id: vehicle.id,
      title,
      description: generatedDescription(vehicle),
      availability,
      condition: "used",
      price: `${(priceCents / 100).toFixed(2)} BRL`,
      link,
      image_link: images[0],
      additional_image_link: images.slice(1, 21).join(","),
      brand: String(vehicle.brand ?? "").trim(),
      model: String(vehicle.model ?? "").trim(),
      version: String(vehicle.version ?? "").trim(),
      year: String(vehicle.year_model || vehicle.year_make || ""),
      mileage: `${Math.max(0, Number(vehicle.mileage) || 0)} km`,
      transmission: String(vehicle.transmission ?? "").trim(),
      fuel_type: String(vehicle.fuel ?? "").trim(),
      body_style: String(vehicle.body_type ?? "").trim(),
      color: String(vehicle.color ?? "").trim(),
      city: location.city,
      state: location.state,
    });
  }

  const invalidCodes = new Set(["missing_title", "missing_link", "invalid_price", "invalid_link", "missing_image"]);
  return {
    csv: toCsv(items),
    items,
    issues,
    generatedAt: now.toISOString(),
    total: vehicles.length,
    exported: items.length,
    ignored: vehicles.length - items.length,
    errors: issues.filter(item => invalidCodes.has(item.code)).length,
  };
}

