import type { VehicleOriginType } from "./vehicle-origin";

/**
 * Regra comercial de preço.
 *
 * O preço que o parceiro pratica (origin_price_cents) nunca é sobrescrito.
 * O que vai para o site, catálogo e WhatsApp é o preço de publicação:
 *
 *   preço de publicação = preço de origem + acréscimo
 *
 * O acréscimo existe para criar margem de negociação com o cliente.
 */
export type PricingMode = "range" | "fixed" | "none";

export type PricingRule = {
  mode: PricingMode;
  /** Piso do acréscimo, em centavos. Usado no modo "range". */
  min_cents: number;
  /** Teto do acréscimo, em centavos. Usado no modo "range". */
  max_cents: number;
  /** Acréscimo aplicado no modo "fixed". */
  fixed_cents: number;
  /** Arredonda o preço final para múltiplos deste valor. 0 desliga. */
  round_to_cents: number;
  /** Origens que recebem acréscimo. Estoque próprio costuma ficar de fora. */
  apply_to: VehicleOriginType[];
};

/**
 * Padrão comercial da casa: R$ 2.000 a mais em todo veículo de terceiro.
 * Valor fixo, sem arredondamento — se o parceiro pede R$ 67.900, publica-se
 * R$ 69.900, sempre. A faixa mínimo/máximo continua disponível no painel para
 * quem quiser variar a margem depois.
 */
export const DEFAULT_PRICING_RULE: PricingRule = {
  mode: "fixed",
  min_cents: 200000,
  max_cents: 300000,
  fixed_cents: 200000,
  round_to_cents: 10000,
  apply_to: ["PARTNER", "PRIVATE"],
};

const ORIGINS: VehicleOriginType[] = ["OWN", "PARTNER", "PRIVATE"];

function toInt(value: unknown, fallback: number) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Lê a regra vinda do banco (jsonb) sem confiar no formato. */
export function normalizePricingRule(value: unknown): PricingRule {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const mode: PricingMode =
    raw.mode === "fixed" || raw.mode === "none" || raw.mode === "range"
      ? (raw.mode as PricingMode)
      : DEFAULT_PRICING_RULE.mode;

  const min = toInt(raw.min_cents, DEFAULT_PRICING_RULE.min_cents);
  const max = toInt(raw.max_cents, DEFAULT_PRICING_RULE.max_cents);

  const applyToRaw = Array.isArray(raw.apply_to) ? raw.apply_to : DEFAULT_PRICING_RULE.apply_to;
  const applyTo = ORIGINS.filter((origin) => applyToRaw.includes(origin));

  return {
    mode,
    min_cents: Math.min(min, max),
    max_cents: Math.max(min, max),
    fixed_cents: toInt(raw.fixed_cents, DEFAULT_PRICING_RULE.fixed_cents),
    round_to_cents: toInt(raw.round_to_cents, DEFAULT_PRICING_RULE.round_to_cents),
    apply_to: applyTo.length ? applyTo : DEFAULT_PRICING_RULE.apply_to,
  };
}

export type MarkupInput = {
  originPriceCents: number;
  originType: VehicleOriginType;
  /** 'auto' segue a regra, 'manual' usa manualMarkupCents, 'none' zera. */
  mode?: string | null;
  manualMarkupCents?: number | null;
};

/**
 * Calcula o acréscimo em centavos.
 *
 * No modo "range" o resultado é determinístico: parte do piso e, se houver
 * arredondamento configurado, sobe o preço final até o múltiplo mais próximo
 * — desde que o acréscimo continue dentro da faixa. Determinístico importa:
 * um valor sorteado faria o preço anunciado mudar sozinho a cada sincronização.
 */
export function resolveMarkupCents(rule: PricingRule, input: MarkupInput): number {
  const origin = input.originPriceCents;
  if (!Number.isFinite(origin) || origin <= 0) return 0;

  if (input.mode === "none") return 0;
  if (input.mode === "manual") return Math.max(0, Math.trunc(Number(input.manualMarkupCents) || 0));

  if (rule.mode === "none") return 0;
  if (!rule.apply_to.includes(input.originType)) return 0;
  if (rule.mode === "fixed") return rule.fixed_cents;

  const step = rule.round_to_cents;
  if (step <= 0) return rule.min_cents;

  const floorPrice = origin + rule.min_cents;
  const rounded = Math.ceil(floorPrice / step) * step;
  const markup = rounded - origin;

  return markup <= rule.max_cents ? markup : rule.min_cents;
}

/** Preço que vai ao ar. Nunca sobrescreve o preço de origem. */
export function computePublishedPriceCents(originPriceCents: number, markupCents: number) {
  const origin = Math.max(0, Math.trunc(Number(originPriceCents) || 0));
  const markup = Math.max(0, Math.trunc(Number(markupCents) || 0));
  return origin + markup;
}

export type PricedVehicle = {
  origin_price_cents?: number | null;
  price_cents: number;
  price_markup_cents?: number | null;
  price_markup_mode?: string | null;
};

/** Acréscimo real gravado no veículo, para exibir no admin e no lead. */
export function vehicleMarkupCents(vehicle: PricedVehicle) {
  const stored = Math.trunc(Number(vehicle.price_markup_cents) || 0);
  if (stored > 0) return stored;
  const origin = Math.trunc(Number(vehicle.origin_price_cents) || 0);
  if (origin > 0 && vehicle.price_cents > origin) return vehicle.price_cents - origin;
  return 0;
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);
}
