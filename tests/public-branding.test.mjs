import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const publicFiles = [
  "src/app/layout.tsx",
  "src/app/(site)/layout.tsx",
  "src/components/Header.tsx",
  "src/components/Footer.tsx",
  "src/app/(site)/sobre/page.tsx",
  "src/app/(site)/contato/page.tsx",
  "src/app/(site)/veiculos/page.tsx",
];

test("identidade pública usa Autodrive e não expõe referências antigas", () => {
  const content = publicFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  assert.match(content, /Autodrive Veículos/);
  assert.doesNotMatch(content, /Auto Drive Veículos/);
  assert.doesNotMatch(content, /instagram\.com\/easycarveiculos/);
  assert.doesNotMatch(content, /facebook\.com\/easycarveiculos/);
  assert.doesNotMatch(content, /Av\. Henrique Gonçalves Baptista/i);
  assert.doesNotMatch(content, /Torre 5, apto 145/i);
});
