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
  const token = readFileSync("src/lib/vercel-blob-token.ts", "utf8");
  assert.match(upload, /@vercel\/blob/);
  assert.match(token, /BLOB_READ_WRITE_TOKEN/);
  assert.match(upload, /api\/uploads/);
});

test("painel de fotos exige sessão antes de abrir a galeria", () => {
  const page = readFileSync("src/app/admin/veiculos/page.tsx", "utf8");
  const panel = readFileSync("src/components/VehiclePhotosPanel.tsx", "utf8");
  const permissions = readFileSync("src/lib/permissions.ts", "utf8");
  assert.match(page, /requireArea\("veiculos"\)/);
  assert.match(permissions, /redirect\("\/admin\/login"\)/);
  assert.match(panel, /resposta\.status === 401/);
  assert.match(panel, /redirecionarParaLogin/);
});

test("painel envia mídia direto, salva a ordem e oferece vídeo padrão ou próprio", () => {
  const panel = readFileSync("src/components/VehiclePhotosPanel.tsx", "utf8");
  const upload = readFileSync("src/lib/client-media-upload.ts", "utf8");
  const gallery = readFileSync("src/components/VehicleGallery.tsx", "utf8");
  const migration = readFileSync("migrations/018_ordem_de_fotos_e_videos.sql", "utf8");
  assert.match(upload, /@vercel\/blob\/client/);
  assert.match(upload, /uploadPresigned/);
  assert.match(panel, /draggable=/);
  assert.match(panel, /acao: "reordenar"/);
  assert.match(panel, /acao: "definir-video"/);
  assert.match(gallery, /vehicle-gallery-video/);
  assert.match(gallery, /orderVehicleGallery/);
  assert.match(migration, /default_vehicle_video_url/);
  assert.match(migration, /REORDENAR/);
});

test("vídeo padrão da vitrine pode ser ativado e vídeos próprios têm prioridade", () => {
  const adminPage = readFileSync("src/app/admin/veiculos/page.tsx", "utf8");
  const component = readFileSync("src/components/DefaultVehicleVideo.tsx", "utf8");
  const publicPage = readFileSync("src/app/(site)/veiculos/[slug]/page.tsx", "utf8");
  const api = readFileSync("src/app/api/admin/default-vehicle-video/route.ts", "utf8");
  const migration = readFileSync("migrations/019_controle_video_padrao.sql", "utf8");

  assert.match(adminPage, /<DefaultVehicleVideo/);
  assert.match(component, /Ativar para todos/);
  assert.match(component, /Desativar em todos/);
  assert.match(component, /Com vídeo próprio/);
  assert.match(publicPage, /vehicle\.video_url \|\| defaultVideo\.effectiveUrl/);
  assert.match(api, /default.*video/i);
  assert.match(api, /inheriting/);
  assert.match(migration, /default_vehicle_video_enabled/);
});

test("configurações controlam o encerramento automático da sessão", () => {
  const page = readFileSync("src/app/admin/configuracoes/page.tsx", "utf8");
  const component = readFileSync("src/components/SessionTimeoutSettings.tsx", "utf8");
  const layout = readFileSync("src/components/AdminLayout.tsx", "utf8");
  const login = readFileSync("src/app/api/auth/login/route.ts", "utf8");
  const refresh = readFileSync("src/app/api/auth/session/refresh/route.ts", "utf8");
  const migration = readFileSync("migrations/020_tempo_sessao_admin.sql", "utf8");

  assert.match(page, /<SessionTimeoutSettings/);
  assert.match(component, /Deslogar automaticamente/);
  assert.match(component, /Salvar configuração/);
  assert.match(layout, /autodrive:session-updated/);
  assert.match(layout, /session\/refresh/);
  assert.match(login, /readSessionTimeoutSettings/);
  assert.match(refresh, /sessionCookieOptions/);
  assert.match(migration, /admin_session_timeout_enabled/);
});
