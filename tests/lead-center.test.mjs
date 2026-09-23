import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("botões do anúncio abrem formulário que gera lead, não só WhatsApp", () => {
  const page = readFileSync("src/app/(site)/veiculos/[slug]/page.tsx", "utf8");
  const form = readFileSync("src/components/VehicleLeadForm.tsx", "utf8");
  assert.match(page, /VehicleLeadActions/);
  assert.match(form, /fetch\("\/api\/leads"/);
  for (const intent of ["simulacao", "interesse", "visita"]) assert.match(form, new RegExp(`intent="${intent}"`));
  for (const field of ["paymentMethod", "hasTrade", "tradeVehicle", "email", "phone", "consent"]) assert.match(form, new RegExp(`name="${field}"`));
});

test("API de leads vincula o veículo do anúncio e envia e-mail depois da resposta", () => {
  const route = readFileSync("src/app/api/leads/route.ts", "utf8");
  assert.match(route, /VEHICLE_INTENTS/);
  assert.match(route, /status='published'/);
  assert.match(route, /after\(/);
  assert.match(route, /sendLeadNotification/);
});

test("configuração de e-mail fica no painel com senha cifrada", () => {
  const settings = readFileSync("src/lib/email-settings.ts", "utf8");
  const email = readFileSync("src/lib/email.ts", "utf8");
  assert.match(settings, /aes-256-gcm/);
  assert.doesNotMatch(settings, /PublicEmailSettings = EmailSettings\b/);
  assert.match(email, /lead_customer/);
  assert.match(email, /não responda/);
});

test("contador de visitas ignora robôs, equipe logada e não guarda IP", () => {
  const track = readFileSync("src/app/api/track/route.ts", "utf8");
  const migration = readFileSync("migrations/023_central_de_controle.sql", "utf8");
  assert.match(track, /isBot/);
  assert.match(track, /SESSION_COOKIE_NAME/);
  assert.doesNotMatch(migration, /^\s*ip\s+(TEXT|INET)/im);
});

test("CRM: quadro com as cinco etapas, ficha editável e exclusão só para administrador", () => {
  const labels = readFileSync("src/lib/admin-labels.ts", "utf8");
  const board = readFileSync("src/components/CrmBoard.tsx", "utf8");
  const route = readFileSync("src/app/api/admin/leads/[id]/route.ts", "utf8");
  for (const stage of ["Aguardando atendimento", "Visita agendada", "Em atendimento", "Sucesso", "Insucesso"]) assert.match(labels, new RegExp(stage));
  // Códigos antigos preservados para os relatórios.
  assert.match(labels, /converted: "Sucesso"/);
  assert.match(labels, /lost: "Insucesso"/);
  assert.match(board, /draggable/);
  assert.match(board, /Voltar etapa/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /role !== "admin"/);
  for (const field of ["scheduledAt", "tags", "vehicleId", "lostReason", "deal", "note"]) assert.match(route, new RegExp(`body\.${field}`));
});
