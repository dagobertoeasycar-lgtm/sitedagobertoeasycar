export type MetaPixelParameters = Record<string, unknown>;

const ALLOWED_PARAMETER_KEYS = new Set([
  "content_ids",
  "content_type",
  "content_name",
  "value",
  "currency",
  "marca",
  "modelo",
  "ano",
  "lead_type",
]);

export function isValidMetaPixelId(value: unknown): boolean {
  return /^\d{5,25}$/.test(String(value ?? "").trim());
}

export function sanitizeMetaPixelParameters(parameters: MetaPixelParameters = {}): MetaPixelParameters {
  const sanitized: MetaPixelParameters = {};

  for (const [key, rawValue] of Object.entries(parameters)) {
    if (!ALLOWED_PARAMETER_KEYS.has(key) || rawValue === undefined || rawValue === null) continue;
    if (key === "content_ids") {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      const contentIds = values.map(String).filter(value => /^EC-[0-9]{6,}$/.test(value));
      if (contentIds.length) sanitized.content_ids = [...new Set(contentIds)];
      continue;
    }
    if (key === "value") {
      const value = Number(rawValue);
      if (Number.isFinite(value) && value >= 0) sanitized.value = Number(value.toFixed(2));
      continue;
    }
    if (key === "ano") {
      const year = Number(rawValue);
      if (Number.isInteger(year) && year >= 1900 && year <= 2200) sanitized.ano = year;
      continue;
    }
    const value = String(rawValue).trim().slice(0, 200);
    if (value) sanitized[key] = value;
  }

  return sanitized;
}
