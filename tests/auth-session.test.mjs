import assert from "node:assert/strict";
import test from "node:test";

process.env.AUTH_SECRET = "teste-de-sessao-autodrive-com-mais-de-32-caracteres";

const auth = await import("../src/lib/session-token.ts");
const settings = await import("../src/lib/session-policy.ts");

test("sessão configurável grava duração e expiração no token assinado", () => {
  const token = auth.createSession("admin-1", 30);
  const parsed = auth.parseSession(token);
  assert.equal(parsed?.userId, "admin-1");
  assert.equal(parsed?.timeoutMinutes, 30);
  assert.ok(parsed?.expiresAt && parsed.expiresAt > Date.now() + 29 * 60 * 1000);
  assert.equal(auth.sessionCookieOptions(30).maxAge, 30 * 60);
});

test("desativar o tempo mantém token válido sem expiração automática", () => {
  const token = auth.createSession("admin-2", null);
  const parsed = auth.parseSession(token);
  assert.equal(parsed?.expiresAt, null);
  assert.equal(parsed?.timeoutMinutes, null);
  assert.equal(auth.sessionCookieOptions(null).maxAge, 365 * 24 * 60 * 60);
});

test("sessão vencida ou adulterada é rejeitada", () => {
  const actualNow = Date.now;
  Date.now = () => actualNow() - 2 * 60 * 60 * 1000;
  const expired = auth.createSession("admin-3", 60);
  Date.now = actualNow;
  assert.equal(auth.parseSession(expired), null);
  const valid = auth.createSession("admin-3", 60);
  const tampered = `${valid.slice(0, -1)}${valid.endsWith("a") ? "b" : "a"}`;
  assert.equal(auth.parseSession(tampered), null);
});

test("limites e textos do tempo de sessão são normalizados", () => {
  assert.equal(settings.normalizeSessionTimeoutMinutes(1), 15);
  assert.equal(settings.normalizeSessionTimeoutMinutes(999999), 7 * 24 * 60);
  assert.equal(settings.normalizeSessionTimeoutMinutes("120"), 120);
  assert.equal(settings.formatSessionDuration(30), "30 minutos");
  assert.equal(settings.formatSessionDuration(480), "8 horas");
  assert.equal(settings.formatSessionDuration(1440), "1 dia");
});
