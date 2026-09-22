/**
 * Campos do editor de anúncio. Fica num lugar só para a tela e a API
 * concordarem sobre o que pode ser gravado e o que a sincronização sobrescreve.
 *
 * syncOwned: a sincronização dos parceiros reescreve esta coluna a cada ciclo
 * (scripts/sync-partners.mjs e sync-easycar.mjs). Em veículo importado, editar
 * esses campos no painel não adianta, então a API recusa e a tela trava.
 */
export type VehicleFieldType = "text" | "longtext" | "int" | "money" | "bool" | "list";

export type VehicleField = {
  key: string;
  column: string;
  type: VehicleFieldType;
  syncOwned?: boolean;
  /** A coluna aceita NULL. Nas demais, texto vazio vira "" e número vazio é recusado. */
  nullable?: boolean;
  max?: number;
};

export const VEHICLE_FIELDS: VehicleField[] = [
  { key: "title", column: "title", type: "text", syncOwned: true, max: 160 },
  { key: "brand", column: "brand", type: "text", syncOwned: true, max: 80 },
  { key: "model", column: "model", type: "text", syncOwned: true, max: 80 },
  { key: "version", column: "version", type: "text", syncOwned: true, max: 160 },
  { key: "yearMake", column: "year_make", type: "int", syncOwned: true },
  { key: "yearModel", column: "year_model", type: "int", syncOwned: true },
  { key: "color", column: "color", type: "text", syncOwned: true, max: 60 },
  { key: "fuel", column: "fuel", type: "text", syncOwned: true, max: 60 },
  { key: "transmission", column: "transmission", type: "text", syncOwned: true, max: 60 },
  { key: "bodyType", column: "body_type", type: "text", syncOwned: true, max: 60 },
  { key: "doors", column: "doors", type: "int", syncOwned: true },
  { key: "mileage", column: "mileage", type: "int", syncOwned: true },
  { key: "price", column: "price_cents", type: "money", syncOwned: true },
  { key: "oldPrice", column: "old_price_cents", type: "money", syncOwned: true, nullable: true },
  { key: "promotion", column: "promotion", type: "bool", syncOwned: true },
  { key: "description", column: "description", type: "longtext", syncOwned: true, max: 8000 },
  { key: "options", column: "options", type: "list", syncOwned: true },
  { key: "city", column: "city", type: "text", max: 100 },
  { key: "featured", column: "featured", type: "bool" },
  { key: "internalNotes", column: "internal_notes", type: "longtext", max: 5000 },
  { key: "plate", column: "plate", type: "text", nullable: true, max: 10 },
  { key: "videoUrl", column: "video_url", type: "text", nullable: true, max: 500 },
  { key: "seoTitle", column: "seo_title", type: "text", nullable: true, max: 70 },
  { key: "seoDescription", column: "seo_description", type: "longtext", nullable: true, max: 170 },
];

export const PUBLICATION_STATUSES = ["draft", "published", "paused", "sold"] as const;
export const STOCK_STATUSES = ["available", "reserved", "sold"] as const;

export type VehicleEditorData = {
  id: string;
  slug: string;
  sourceId: string | null;
  externalId: string | null;
  sourceUrl: string | null;
  originType: string;
  partnerName: string | null;
  status: string;
  stockStatus: string;
  imageUrl: string | null;
  images: unknown;
  photosLocked: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  originPriceCents: number | null;
  markupCents: number | null;
  values: Record<string, string | number | boolean | string[] | null>;
};

/** Converte um valor vindo do formulário para o tipo da coluna. */
export function coerceField(field: VehicleField, raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (field.type) {
    case "text":
    case "longtext": {
      const text = String(raw ?? "").trim();
      if (field.max && text.length > field.max) return { ok: false, error: `${field.key}: máximo de ${field.max} caracteres` };
      return { ok: true, value: text || (field.nullable ? null : "") };
    }
    case "int": {
      if (raw === "" || raw === null || raw === undefined) {
        return field.nullable ? { ok: true, value: null } : { ok: false, error: `${field.key}: obrigatório` };
      }
      const number = Number(raw);
      if (!Number.isInteger(number) || number < 0) return { ok: false, error: `${field.key}: número inválido` };
      return { ok: true, value: number };
    }
    case "money": {
      if (raw === "" || raw === null || raw === undefined) {
        return field.nullable ? { ok: true, value: null } : { ok: false, error: `${field.key}: obrigatório` };
      }
      // Aceita 112900.5 (campo numérico) e 112.900,50 (digitado à mão).
      const text = String(raw).trim();
      const number = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
      if (!Number.isFinite(number) || number < 0) return { ok: false, error: `${field.key}: valor inválido` };
      return { ok: true, value: Math.round(number * 100) };
    }
    case "bool":
      return { ok: true, value: raw === true || raw === "true" || raw === "on" || raw === 1 };
    case "list": {
      const list = Array.isArray(raw) ? raw : String(raw ?? "").split(/\r?\n|,/);
      return { ok: true, value: list.map((item) => String(item).trim()).filter(Boolean).slice(0, 200) };
    }
  }
}

/** Valor da coluna no formato que o formulário usa (dinheiro em reais). */
export function formValue(field: VehicleField, value: unknown) {
  if (value === null || value === undefined) return field.type === "bool" ? false : field.type === "list" ? [] : null;
  if (field.type === "money") return Number(value) / 100;
  if (field.type === "list") return Array.isArray(value) ? value.map(String) : [];
  return value as string | number | boolean;
}
