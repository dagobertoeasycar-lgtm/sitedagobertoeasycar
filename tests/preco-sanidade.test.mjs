import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRICE_SANITY, motivoPrecoImplausivel } from "../scripts/connectors/shared.mjs";

// Os valores deste teste são os que estavam de fato publicados no site em
// 17/09/2026, vindos do estoque de origem como espaço reservado.
test("recusa os preços de espaço reservado que estavam no ar", () => {
  assert.match(motivoPrecoImplausivel(333333333), /acima do máximo/);
  assert.match(motivoPrecoImplausivel(100000000), /acima do máximo/);
  assert.match(motivoPrecoImplausivel(333540000), /acima do máximo/);
});

test("aceita a faixa real do estoque", () => {
  assert.equal(motivoPrecoImplausivel(7900000), null, "mediana R$ 79.000");
  assert.equal(motivoPrecoImplausivel(45998000), null, "Volvo XC R$ 459.980");
  assert.equal(motivoPrecoImplausivel(20190000), null, "Fiat Toro R$ 201.900");
  assert.equal(motivoPrecoImplausivel(300000), null, "exatamente no piso");
  assert.equal(motivoPrecoImplausivel(90000000), null, "exatamente no teto");
});

test("recusa preço ausente, zero ou negativo", () => {
  assert.match(motivoPrecoImplausivel(0), /sem preço/);
  assert.match(motivoPrecoImplausivel(null), /sem preço/);
  assert.match(motivoPrecoImplausivel(undefined), /sem preço/);
  assert.match(motivoPrecoImplausivel(-5000), /sem preço/);
  assert.match(motivoPrecoImplausivel("abacaxi"), /sem preço/);
});

test("recusa abaixo do piso", () => {
  assert.match(motivoPrecoImplausivel(100), /abaixo do mínimo/);
  assert.match(motivoPrecoImplausivel(299999), /abaixo do mínimo/);
});

test("a faixa vem do banco quando existe, e cai no padrão quando não", () => {
  const apertada = { min_cents: 1000000, max_cents: 2000000 };
  assert.match(motivoPrecoImplausivel(7900000, apertada), /acima do máximo/);
  assert.equal(motivoPrecoImplausivel(1500000, apertada), null);
  // faixa incompleta ou lixo não deve derrubar o sync: usa o padrão
  assert.equal(motivoPrecoImplausivel(7900000, {}), null);
  assert.equal(motivoPrecoImplausivel(7900000, null), null);
});

test("a mensagem mostra o valor em reais, para dar para agir", () => {
  const m = motivoPrecoImplausivel(333333333);
  assert.match(m, /3\.333\.333/);
  assert.equal(DEFAULT_PRICE_SANITY.min_cents, 300000);
  assert.equal(DEFAULT_PRICE_SANITY.max_cents, 90000000);
});
