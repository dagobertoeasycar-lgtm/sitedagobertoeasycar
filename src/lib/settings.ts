import { query } from "@/lib/db";
import { DEFAULT_PRICING_RULE, normalizePricingRule, type PricingRule } from "@/lib/pricing";

export type StockRule = {
  /** Execuções seguidas sem encontrar o veículo antes de marcá-lo indisponível. */
  missing_checks_before_inactive: number;
};

export const DEFAULT_STOCK_RULE: StockRule = { missing_checks_before_inactive: 2 };

async function readSetting(key: string): Promise<unknown> {
  try {
    const result = await query<{ value: unknown }>("SELECT value FROM app_settings WHERE key = $1", [key]);
    return result.rows[0]?.value ?? null;
  } catch {
    // Banco sem a migration 012 ainda: cai no padrão em vez de derrubar a página.
    return null;
  }
}

async function writeSetting(key: string, value: unknown) {
  await query(
    `INSERT INTO app_settings(key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function getPricingRule(): Promise<PricingRule> {
  const raw = await readSetting("pricing_rule");
  return raw ? normalizePricingRule(raw) : DEFAULT_PRICING_RULE;
}

export async function savePricingRule(rule: PricingRule) {
  await writeSetting("pricing_rule", normalizePricingRule(rule));
}

export async function getStockRule(): Promise<StockRule> {
  const raw = await readSetting("stock_rule");
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const checks = Math.trunc(Number(value.missing_checks_before_inactive));
  return {
    missing_checks_before_inactive:
      Number.isFinite(checks) && checks >= 1 ? checks : DEFAULT_STOCK_RULE.missing_checks_before_inactive,
  };
}

export async function saveStockRule(rule: StockRule) {
  await writeSetting("stock_rule", {
    missing_checks_before_inactive: Math.max(1, Math.trunc(Number(rule.missing_checks_before_inactive) || 2)),
  });
}
