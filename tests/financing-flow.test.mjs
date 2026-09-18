import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("vitrine pública usa 28 veículos por página", () => {
  const vehicles = readFileSync("src/lib/vehicles.ts", "utf8");
  const page = readFileSync("src/app/(site)/veiculos/page.tsx", "utf8");
  assert.match(vehicles, /VEHICLE_PAGE_SIZE\s*=\s*28/);
  assert.match(page, /VEHICLE_PAGE_SIZE/);
});

test("serviços de financiamento ficam separados por origem", () => {
  const form = readFileSync("src/components/FinancingForm.tsx", "utf8");
  const page = readFileSync("src/app/(site)/financiamento/page.tsx", "utf8");
  const success = readFileSync("src/app/(site)/financiamento/sucesso/page.tsx", "utf8");

  assert.match(page, /listVehicleChoices/);
  assert.match(page, /veículos publicados por lojas parceiras/i);
  assert.match(form, /financingService/);
  assert.match(readFileSync("src/app/(site)/financia-facil/page.tsx", "utf8"), /negociação particular/i);
  assert.match(readFileSync("src/lib/financing.ts", "utf8"), /partners/);
  assert.match(readFileSync("src/lib/financing.ts", "utf8"), /private/);
  assert.match(readFileSync("src/lib/financing.ts", "utf8"), /successHref: "\/financiamento\/sucesso"/);
  assert.match(success, /Recebemos sua simulação/);
});

test("uploads usam Vercel Blob quando configurado e mantêm fallback local", () => {
  const upload = readFileSync("src/lib/image-upload.ts", "utf8");
  assert.match(upload, /@vercel\/blob/);
  assert.match(upload, /BLOB_READ_WRITE_TOKEN/);
  assert.match(upload, /api\/uploads/);
});
