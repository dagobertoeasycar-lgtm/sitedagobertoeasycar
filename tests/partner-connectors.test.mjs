import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanText,
  clampMileage,
  extractJsonArray,
  normalizeVehicle,
  passaFiltroTipo,
  readNextData,
  readRscPayload,
  slugify,
  toCents,
  toInt,
} from "../scripts/connectors/shared.mjs";

test("toCents aceita número, texto brasileiro e texto com moeda", () => {
  assert.equal(toCents(39870), 3987000);
  assert.equal(toCents("29.900,00"), 2990000);
  assert.equal(toCents("R$ 29.900,00"), 2990000);
  assert.equal(toCents("Preço R$ 1.234,56"), 123456);
  assert.equal(toCents(0), 0);
  assert.equal(toCents(null), 0);
  assert.equal(toCents("grátis"), 0);
});

test("toCents respeita o teto do integer do banco", () => {
  assert.equal(toCents(99999999), 2000000000);
});

test("clampMileage protege a coluna integer de km absurdo digitado na origem", () => {
  assert.equal(clampMileage("143.328"), 143328);
  assert.equal(clampMileage(3333333333), 2000000);
  assert.equal(clampMileage("0 km"), 0);
});

test("cleanText resolve entidades HTML e limpa emoji", () => {
  assert.equal(cleanText("Ve&#xED;culo em bom estado"), "Veículo em bom estado");
  assert.equal(cleanText("Carro &amp; moto"), "Carro & moto");
  assert.equal(cleanText("  muitos     espaços  "), "muitos espaços");
  assert.equal(cleanText("Oferta 🔥 imperdível"), "Oferta imperdível");
});

test("slugify gera url segura sem acento", () => {
  assert.equal(slugify("Citroën AIRCROSS 2017"), "citroen-aircross-2017");
  assert.equal(slugify("  Fiat/Uno  "), "fiat-uno");
});

test("toInt extrai apenas dígitos", () => {
  assert.equal(toInt("2006/2006"), 20062006);
  assert.equal(toInt("88.000 km"), 88000);
  assert.equal(toInt("abc"), 0);
});

test("filtro de tipo descarta moto mas nunca descarta por rótulo desconhecido", () => {
  assert.equal(passaFiltroTipo("motocicleta", "cars"), false);
  assert.equal(passaFiltroTipo("Moto", "cars"), false);
  assert.equal(passaFiltroTipo("caminhao", "cars"), false);
  assert.equal(passaFiltroTipo("automovel", "cars"), true);
  assert.equal(passaFiltroTipo("carro", "cars"), true);
  assert.equal(passaFiltroTipo("", "cars"), true);
  assert.equal(passaFiltroTipo(null, "cars"), true);
  assert.equal(passaFiltroTipo("categoria nova qualquer", "cars"), true);
  // filtro 'all' aceita tudo
  assert.equal(passaFiltroTipo("motocicleta", "all"), true);
});

test("extractJsonArray equilibra colchetes e sobrevive a colchete dentro de string", () => {
  const texto = `lixo antes {"vehicles":[{"id":"1","desc":"tem [colchete] e \\"aspas\\" aqui"},{"id":"2"}],"outro":1}`;
  const arr = extractJsonArray(texto, "vehicles");
  assert.ok(Array.isArray(arr));
  assert.equal(arr.length, 2);
  assert.equal(arr[1].id, "2");
  assert.equal(extractJsonArray(texto, "inexistente"), null);
});

test("readRscPayload remonta os pedaços que o Next injeta", () => {
  const html = `<script>self.__next_f.push([1,"{\\"vehicles\\":[{\\"id\\":\\"a\\"}"])</script>
                <script>self.__next_f.push([1,"]}"])</script>`;
  const rsc = readRscPayload(html);
  const arr = extractJsonArray(rsc, "vehicles");
  assert.deepEqual(arr, [{ id: "a" }]);
});

test("readNextData devolve null sem quebrar quando a página não é Next", () => {
  assert.equal(readNextData("<html><body>nada</body></html>"), null);
  const bom = `<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"ads":{"items":[]}}}}</script>`;
  assert.deepEqual(readNextData(bom).props.pageProps.ads.items, []);
});

test("normalizeVehicle monta o registro com os limites do banco", () => {
  const v = normalizeVehicle({
    externalId: 850556718,
    title: "Audi A3",
    brand: "Audi",
    model: "A3",
    version: "AUDI A3 1.6 GASOLINA",
    yearMake: 2005,
    yearModel: 2005,
    originPriceCents: 3987000,
    mileage: 225476,
    fuel: "Gasolina",
    transmission: "Manual",
    color: "Cinza",
    doors: 4,
    description: "x".repeat(6000),
    media: ["https://cdn.exemplo/a.jpg", "nao-url", "https://cdn.exemplo/b.jpg"],
    options: ["Air bag motorista", { nome: "Ar-condicionado" }, ""],
    plate: "dmy-6a05",
    vehicleType: "carro",
    sourceUrl: "https://exemplo/anuncio/1",
  });

  assert.equal(v.externalId, "850556718");
  assert.equal(v.slug, "audi-a3-audi-a3-1-6-gasolina-2005-850556718");
  assert.equal(v.media.length, 2, "url inválida deve ser descartada");
  assert.equal(v.imageUrl, "https://cdn.exemplo/a.jpg");
  assert.equal(v.description.length, 5000, "descrição é truncada em 5000");
  assert.deepEqual(v.options, ["Air bag motorista", "Ar-condicionado"]);
  assert.equal(v.plate, "DMY6A05", "placa vira maiúscula sem separador");
  assert.equal(v.doors, 4);
});

test("normalizeVehicle assume 4 portas e deduz ano quando falta um dos dois", () => {
  const v = normalizeVehicle({ externalId: 1, title: "Carro", yearModel: 2020, originPriceCents: 5000000 });
  assert.equal(v.yearMake, 2020);
  assert.equal(v.doors, 4);
  assert.equal(v.plate, null);
  assert.deepEqual(v.media, []);
  assert.equal(v.imageUrl, null);
});
