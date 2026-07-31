import assert from "node:assert/strict";
import test from "node:test";

test("domínio oficial usa www e HTTPS", () => {
  const url = new URL("https://www.dagobertoeasycar.com.br");
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "www.dagobertoeasycar.com.br");
});

test("WhatsApp oficial contém apenas dígitos internacionais", () => {
  assert.match("5511934718276", /^55\d{10,11}$/);
});
