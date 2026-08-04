import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaFeed,
  DEFAULT_META_FEED_SETTINGS,
  META_FEED_HEADERS,
  publicHttpsUrl,
} from "../src/lib/meta-feed.ts";

function vehicle(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    catalog_item_id: "EC-000125",
    slug: "volkswagen-t-cross-2025",
    title: "Volkswagen T-Cross",
    description: "SUV seminovo",
    status: "published",
    stock_status: "available",
    price_cents: 18590000,
    image_url: "https://images.example.com/t-cross.jpg",
    images: [{ type: "image", url: "https://images.example.com/t-cross-2.jpg" }],
    brand: "Volkswagen",
    model: "T-Cross",
    version: "Highline",
    year_make: 2025,
    year_model: 2025,
    mileage: 0,
    transmission: "Automático",
    fuel: "Flex",
    body_type: "SUV",
    color: "Branco",
    city: "Osasco/SP",
    ...overrides,
  };
}

test("veículo novo publicado é exportado com ID estável e preço BRL", () => {
  const result = buildMetaFeed([vehicle()]);
  assert.equal(result.exported, 1);
  assert.equal(result.items[0].id, "EC-000125");
  assert.equal(result.items[0].price, "185900.00 BRL");
  assert.equal(result.items[0].availability, "in stock");
});

test("alterar preço e foto não altera o ID do item", () => {
  const before = buildMetaFeed([vehicle()]).items[0];
  const after = buildMetaFeed([vehicle({ price_cents: 17999000, image_url: "https://images.example.com/nova.jpg" })]).items[0];
  assert.equal(after.id, before.id);
  assert.equal(after.price, "179990.00 BRL");
  assert.equal(after.image_link, "https://images.example.com/nova.jpg");
});

test("veículo reservado usa disponibilidade configurada", () => {
  const result = buildMetaFeed([vehicle({ stock_status: "reserved" })]);
  assert.equal(result.items[0].availability, "out of stock");
});

test("veículo vendido pode ser excluído ou marcado indisponível", () => {
  const excluded = buildMetaFeed([vehicle({ stock_status: "sold" })]);
  assert.equal(excluded.exported, 0);
  const settings = { ...DEFAULT_META_FEED_SETTINGS, availabilitySold: "out of stock" };
  const unavailable = buildMetaFeed([vehicle({ stock_status: "sold" })], settings);
  assert.equal(unavailable.items[0].availability, "out of stock");
});

test("veículo despublicado não aparece no feed", () => {
  const result = buildMetaFeed([vehicle({ status: "paused" })]);
  assert.equal(result.exported, 0);
  assert.equal(result.issues[0].code, "not_published");
});

test("veículo sem imagem é ignorado por padrão", () => {
  const result = buildMetaFeed([vehicle({ image_url: null, images: [] })]);
  assert.equal(result.exported, 0);
  assert.equal(result.errors, 1);
  assert.equal(result.issues[0].code, "missing_image");
});

test("imagem Em breve pode ser usada quando habilitada", () => {
  const settings = { ...DEFAULT_META_FEED_SETTINGS, includeWithoutImages: true };
  const result = buildMetaFeed([vehicle({ image_url: null, images: [] })], settings);
  assert.equal(result.exported, 1);
  assert.equal(result.items[0].image_link, "https://www.dagobertoeasycar.com.br/em-breve.jpg");
});

test("vírgulas, aspas, quebras de linha e caracteres especiais são escapados", () => {
  const result = buildMetaFeed([vehicle({ title: 'SUV "Edição", São Paulo', description: "Linha 1\nLinha 2" })]);
  assert.match(result.csv, /"SUV ""Edição"", São Paulo"/);
  assert.match(result.csv, /Linha 1\nLinha 2/);
  assert.match(result.csv, /Automático/);
});

test("URLs locais, Windows, HTTP e localhost são rejeitadas", () => {
  assert.equal(publicHttpsUrl("C:\\Fotos\\carro.jpg"), null);
  assert.equal(publicHttpsUrl("http://localhost:3100/a.jpg"), null);
  assert.equal(publicHttpsUrl("http://images.example.com/a.jpg"), null);
  assert.equal(publicHttpsUrl("/api/uploads/a.jpg"), "https://www.dagobertoeasycar.com.br/api/uploads/a.jpg");
});

test("imagem principal e adicionais usam apenas HTTPS público", () => {
  const result = buildMetaFeed([vehicle({
    image_url: "/api/uploads/main.jpg",
    images: [
      { type: "video", url: "https://youtu.be/test" },
      { type: "image", url: "https://images.example.com/extra.jpg" },
      { type: "image", url: "http://localhost/secret.jpg" },
    ],
  })]);
  assert.equal(result.items[0].image_link, "https://www.dagobertoeasycar.com.br/api/uploads/main.jpg");
  assert.equal(result.items[0].additional_image_link, "https://images.example.com/extra.jpg");
});

test("CSV contém somente campos comerciais e automotivos permitidos", () => {
  const forbidden = ["plate", "placa", "renavam", "chassi", "cost", "custo", "customer", "phone"];
  const normalized = META_FEED_HEADERS.join(",").toLowerCase();
  for (const field of forbidden) assert.equal(normalized.includes(field), false);
  assert.deepEqual(META_FEED_HEADERS.slice(0, 9), ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "additional_image_link"]);
});

test("ano, quilometragem, localização e atributos são exportados", () => {
  const item = buildMetaFeed([vehicle({ city: "Osasco/SP", mileage: 97948 })]).items[0];
  assert.equal(item.year, "2025");
  assert.equal(item.mileage, "97948 km");
  assert.equal(item.city, "Osasco");
  assert.equal(item.state, "SP");
  assert.equal(item.transmission, "Automático");
  assert.equal(item.fuel_type, "Flex");
});
