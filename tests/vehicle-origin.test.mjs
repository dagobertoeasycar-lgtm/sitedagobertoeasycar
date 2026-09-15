import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeVehicleOrigin,
  resolveVehicleOrigin,
  vehicleOriginBadgeLabel,
  vehiclePublicLocation,
} from "../src/lib/vehicle-origin.ts";

test("normaliza filtros públicos de origem para valores internos", () => {
  assert.equal(normalizeVehicleOrigin("autodrive"), "OWN");
  assert.equal(normalizeVehicleOrigin("parceiros"), "PARTNER");
  assert.equal(normalizeVehicleOrigin("particulares"), "PRIVATE");
  assert.equal(normalizeVehicleOrigin("desconhecido"), null);
});

test("classifica veículos antigos da EasyCar como parceiro sem expor loja", () => {
  const vehicle = { origin_type: null, source_id: "easycar_scraper", store: "Easycar - Matriz", city: "Osasco/SP" };
  assert.equal(resolveVehicleOrigin(vehicle), "PARTNER");
  assert.equal(vehicleOriginBadgeLabel(vehicle), "LOJISTA PARCEIRO");
  assert.equal(vehiclePublicLocation(vehicle), "Parceiro Autodrive - Osasco/SP");
});

test("classifica estoque próprio e particular com textos públicos", () => {
  assert.equal(vehicleOriginBadgeLabel({ origin_type: "OWN", source_id: null, store: "" }), "ESTOQUE AUTODRIVE");
  assert.equal(
    vehiclePublicLocation({ origin_type: "PRIVATE", source_id: null, store: "", city: "Barueri/SP" }),
    "Particular intermediado - Barueri/SP",
  );
});
