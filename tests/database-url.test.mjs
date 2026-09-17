import assert from "node:assert/strict";
import test from "node:test";
import { validarDatabaseUrl } from "../scripts/check-database-url.mjs";

test("aceita uma URL de Postgres bem formada", () => {
  const r = validarDatabaseUrl("postgresql://usuario:senha@db.exemplo.com:5432/autodrive");
  assert.equal(r.ok, true);
  assert.match(r.resumo, /banco autodrive/);
});

test("aceita postgres:// e sslmode na query", () => {
  const r = validarDatabaseUrl("postgres://u:p@db.exemplo.com:5432/base_real?sslmode=require");
  assert.equal(r.ok, true);
  assert.match(r.resumo, /ssl require/);
});

test("nunca expõe usuário, senha ou host inteiro no resumo", () => {
  const r = validarDatabaseUrl("postgresql://joao:segredo123@db.producao.interna:5432/autodrive");
  assert.equal(r.ok, true);
  assert.ok(!r.resumo.includes("joao"), "usuário não pode aparecer");
  assert.ok(!r.resumo.includes("segredo123"), "senha não pode aparecer");
  assert.ok(!r.resumo.includes("db.producao.interna"), "host completo não pode aparecer");
});

test("pega o caso real que derrubou o Actions: host 'base'", () => {
  const r = validarDatabaseUrl("postgresql://usuario:senha@base/autodrive");
  assert.equal(r.ok, false);
  assert.match(r.motivo, /parece texto de exemplo/);
  assert.match(r.motivo, /EAI_AGAIN/);
});

test("recusa outros hosts de exemplo", () => {
  for (const host of ["host", "servidor", "exemplo", "seu-host"]) {
    assert.equal(validarDatabaseUrl(`postgresql://u:p@${host}/banco`).ok, false, host);
  }
});

test("recusa quando o nome da variável foi colado dentro do valor", () => {
  const r = validarDatabaseUrl("DATABASE_URL=postgresql://u:p@db.exemplo.com/banco");
  assert.equal(r.ok, false);
  assert.match(r.motivo, /contém o próprio nome/);
});

test("recusa espaço ou quebra de linha nas pontas", () => {
  assert.equal(validarDatabaseUrl(" postgresql://u:p@db.exemplo.com/banco").ok, false);
  assert.equal(validarDatabaseUrl("postgresql://u:p@db.exemplo.com/banco\n").ok, false);
});

test("recusa vazia, protocolo errado, sem host e sem banco", () => {
  assert.match(validarDatabaseUrl("").motivo, /não está definida/);
  assert.match(validarDatabaseUrl(undefined).motivo, /não está definida/);
  assert.match(validarDatabaseUrl("mysql://u:p@db.exemplo.com/banco").motivo, /Protocolo/);
  assert.match(validarDatabaseUrl("postgresql://db.exemplo.com").motivo, /sem o nome do banco/);
  assert.equal(validarDatabaseUrl("isso nao e url").ok, false);
});
