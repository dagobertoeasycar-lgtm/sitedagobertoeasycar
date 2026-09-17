import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PRICING_RULE,
  computePublishedPriceCents,
  normalizePricingRule,
  resolveMarkupCents,
  vehicleMarkupCents,
} from "../src/lib/pricing.ts";

test("normaliza regra vinda do banco e corrige faixa invertida", () => {
  const rule = normalizePricingRule({ mode: "range", min_cents: 300000, max_cents: 200000 });
  assert.equal(rule.min_cents, 200000);
  assert.equal(rule.max_cents, 300000);
  assert.deepEqual(normalizePricingRule(null), DEFAULT_PRICING_RULE);
  assert.equal(normalizePricingRule({ mode: "coisa" }).mode, DEFAULT_PRICING_RULE.mode);
});

test("padrão da casa: todo veículo de terceiro sai R$ 2.000 acima do preço de origem", () => {
  const rule = DEFAULT_PRICING_RULE;
  for (const origem of [6790000, 10890000, 11590000, 19898000, 5432100]) {
    const markup = resolveMarkupCents(rule, { originPriceCents: origem, originType: "PARTNER" });
    assert.equal(markup, 200000, `acréscimo deveria ser R$ 2.000 para origem ${origem}`);
    assert.equal(computePublishedPriceCents(origem, markup), origem + 200000);
  }
  // Vale igual para venda particular.
  assert.equal(resolveMarkupCents(rule, { originPriceCents: 6790000, originType: "PRIVATE" }), 200000);
});

test("acréscimo do parceiro fica dentro da faixa e arredonda o preço final", () => {
  const rule = normalizePricingRule({
    mode: "range",
    min_cents: 200000,
    max_cents: 300000,
    round_to_cents: 10000,
    apply_to: ["PARTNER", "PRIVATE"],
  });
  // R$ 67.900 + piso de R$ 2.000 = R$ 69.900, já múltiplo de R$ 100.
  const markup = resolveMarkupCents(rule, { originPriceCents: 6790000, originType: "PARTNER" });
  assert.equal(markup, 200000);
  assert.equal(computePublishedPriceCents(6790000, markup), 6990000);
  assert.ok(markup >= rule.min_cents && markup <= rule.max_cents);
});

test("preço quebrado sobe até o múltiplo seguinte sem estourar o teto", () => {
  const rule = normalizePricingRule({
    mode: "range",
    min_cents: 200000,
    max_cents: 300000,
    round_to_cents: 10000,
  });
  // R$ 67.943 + R$ 2.000 = R$ 69.943 → arredonda para R$ 70.000.
  const markup = resolveMarkupCents(rule, { originPriceCents: 6794300, originType: "PARTNER" });
  assert.equal(computePublishedPriceCents(6794300, markup) % 10000, 0);
  assert.ok(markup >= 200000 && markup <= 300000);
});

test("é determinístico: mesma entrada, mesmo preço em toda sincronização", () => {
  const rule = normalizePricingRule({ mode: "range", min_cents: 200000, max_cents: 300000, round_to_cents: 10000 });
  const input = { originPriceCents: 8812700, originType: "PARTNER" };
  assert.equal(resolveMarkupCents(rule, input), resolveMarkupCents(rule, input));
});

test("estoque próprio não recebe acréscimo quando fora do apply_to", () => {
  const rule = normalizePricingRule({ mode: "range", min_cents: 200000, max_cents: 300000, apply_to: ["PARTNER"] });
  assert.equal(resolveMarkupCents(rule, { originPriceCents: 5000000, originType: "OWN" }), 0);
  assert.equal(resolveMarkupCents(rule, { originPriceCents: 5000000, originType: "PARTNER" }), 200000);
});

test("override por veículo: manual e sem acréscimo", () => {
  const rule = normalizePricingRule({ mode: "range", min_cents: 200000, max_cents: 300000 });
  assert.equal(
    resolveMarkupCents(rule, { originPriceCents: 5000000, originType: "PARTNER", mode: "manual", manualMarkupCents: 450000 }),
    450000,
  );
  assert.equal(
    resolveMarkupCents(rule, { originPriceCents: 5000000, originType: "PARTNER", mode: "none" }),
    0,
  );
});

test("modo fixo aplica sempre o mesmo acréscimo", () => {
  const rule = normalizePricingRule({ mode: "fixed", fixed_cents: 300000 });
  assert.equal(resolveMarkupCents(rule, { originPriceCents: 6790000, originType: "PARTNER" }), 300000);
  assert.equal(computePublishedPriceCents(6790000, 300000), 7090000);
});

test("preço zerado ou inválido não gera acréscimo", () => {
  const rule = normalizePricingRule({ mode: "range" });
  assert.equal(resolveMarkupCents(rule, { originPriceCents: 0, originType: "PARTNER" }), 0);
  assert.equal(resolveMarkupCents(rule, { originPriceCents: Number.NaN, originType: "PARTNER" }), 0);
});

test("acréscimo do veículo é deduzido quando não foi gravado", () => {
  assert.equal(vehicleMarkupCents({ origin_price_cents: 6790000, price_cents: 6990000 }), 200000);
  assert.equal(vehicleMarkupCents({ origin_price_cents: 6790000, price_cents: 6790000 }), 0);
  assert.equal(vehicleMarkupCents({ origin_price_cents: null, price_cents: 6790000 }), 0);
});
