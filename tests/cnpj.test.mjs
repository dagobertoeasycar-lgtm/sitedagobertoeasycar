import test from "node:test";
import assert from "node:assert/strict";
import { formatCnpj, isValidCnpj } from "../src/lib/cnpj.ts";

test("valida CNPJs com dígitos verificadores corretos", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000181"), true);
});

test("rejeita CNPJ inválido, incompleto ou repetido", () => {
  assert.equal(isValidCnpj("11.222.333/0001-82"), false);
  assert.equal(isValidCnpj("11.222.333/0001"), false);
  assert.equal(isValidCnpj("00.000.000/0000-00"), false);
});

test("formata CNPJ durante a digitação", () => {
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
});
