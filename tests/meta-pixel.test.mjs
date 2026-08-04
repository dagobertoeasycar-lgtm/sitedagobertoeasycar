import assert from "node:assert/strict";
import test from "node:test";
import { isValidMetaPixelId, sanitizeMetaPixelParameters } from "../src/lib/meta-pixel.ts";

test("aceita somente ID numérico de Pixel", () => {
  assert.equal(isValidMetaPixelId("123456789012345"), true);
  assert.equal(isValidMetaPixelId("PIXEL-123"), false);
  assert.equal(isValidMetaPixelId(""), false);
});

test("eventos permitem parâmetros comerciais e removem dados pessoais", () => {
  const result = sanitizeMetaPixelParameters({
    content_ids: ["EC-000125", "inválido"], content_type: "product", content_name: "Veículo de teste",
    value: 89990, currency: "BRL", marca: "Ford", modelo: "Ranger", ano: 2025,
    email: "cliente@example.com", phone: "11999999999", cpf: "00000000000",
  });
  assert.deepEqual(result.content_ids, ["EC-000125"]);
  assert.equal(result.currency, "BRL");
  assert.equal("email" in result, false);
  assert.equal("phone" in result, false);
  assert.equal("cpf" in result, false);
});
