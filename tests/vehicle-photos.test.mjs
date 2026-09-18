import assert from "node:assert/strict";
import test from "node:test";
import {
  caminhoDoVeiculo,
  ehMarcaDaLoja,
  fotosParaTratamento,
  fotosPublicaveis,
  limparNomeDePasta,
  nomeDaFoto,
  normalizarFotos,
  pastaDoParceiro,
  pastaDoVeiculo,
  separarFotos,
} from "../src/lib/vehicle-photos.ts";
import { crc32, montarZip, nomeSeguroNoZip } from "../src/lib/zip.ts";

const AUTOCONF = "https://autoconf-production.s3.amazonaws.com/veiculos/fotos/1120038";
const BNDV_CARRO = "https://cdn-sistema-lojistas.bndv.com.br/vehicles-images/sistema.lojistas/11271/1522819";
const BNDV_LOGO = "https://bndvsitesst.blob.core.windows.net/sites-logo/clientes/766/logo.jpeg";
const BNDV_BANNER = "https://bndvsitesst.blob.core.windows.net/sites-banners/default/Ofertas-2018.png";

test("logotipo e banner do parceiro são marca da loja, nunca foto do carro", () => {
  assert.equal(ehMarcaDaLoja(BNDV_LOGO), true);
  assert.equal(ehMarcaDaLoja(BNDV_BANNER), true);
  assert.equal(ehMarcaDaLoja(`${BNDV_CARRO}/39332988.webp`), false);
});

test("capa da Now Car era o logotipo da loja e sai da galeria", () => {
  // Reproduz o que a página de detalhe da Now Car devolvia: o logotipo vinha
  // em primeiro, virava image_url e o site publicava o nome da loja como capa.
  const { fotos, artesDaLoja } = separarFotos([
    BNDV_LOGO,
    `${BNDV_CARRO}/a.webp`,
    `${BNDV_CARRO}/b.webp`,
  ]);
  assert.deepEqual(artesDaLoja, [BNDV_LOGO]);
  assert.equal(fotos[0], `${BNDV_CARRO}/a.webp`);
});

test("no AutoConf a capa em PNG é a arte com o nome da loja", () => {
  // Galeria do veículo 1120038 (Celta) como a origem entrega: 15 fotos, png
  // na posição 0 (capa com o logotipo) e na 14 (tarja "CARRO DE REPASSE").
  const galeria = Array.from({ length: 15 }, (_, i) =>
    i === 0 || i === 14 ? `${AUTOCONF}/arte-${i}.png` : `${AUTOCONF}/${i}.jpeg`,
  );
  const { fotos, artesDaLoja } = separarFotos(galeria);

  assert.deepEqual(artesDaLoja, [`${AUTOCONF}/arte-0.png`, `${AUTOCONF}/arte-14.png`]);
  assert.equal(fotos.length, 13);
  assert.equal(fotos[0], `${AUTOCONF}/1.jpeg`, "a capa publicada passa a ser foto de verdade");
});

test("galeria inteira em PNG perde só a capa, não as 23 fotos boas", () => {
  // Caso real: veículo 1077701 (Jeep Commander) no Tchesco Car. Só a primeira
  // é arte da loja; as outras são foto crua de interior e lataria que a loja
  // exportou em png. Descartar por extensão apagaria o veículo inteiro.
  const galeria = Array.from({ length: 24 }, (_, i) => `${AUTOCONF}/${i}.png`);
  const { fotos, artesDaLoja } = separarFotos(galeria);
  assert.deepEqual(artesDaLoja, [`${AUTOCONF}/0.png`]);
  assert.equal(fotos.length, 23);
  assert.equal(fotos[0], `${AUTOCONF}/1.png`);
});

test("galeria só de arte continua publicável, mas nunca entra em tratamento", () => {
  const soMarca = [BNDV_LOGO];
  assert.deepEqual(fotosPublicaveis(soMarca), soMarca, "melhor o logotipo do que card vazio");
  assert.deepEqual(fotosParaTratamento(soMarca), [], "tratar logotipo seria trabalho jogado fora");

  const soCapa = [`${AUTOCONF}/capa.png`];
  assert.deepEqual(fotosPublicaveis(soCapa), soCapa, "carro sem outra foto fica com a arte");
  assert.deepEqual(fotosParaTratamento(soCapa), []);
});

test("PNG tratado por nós não é confundido com arte do parceiro", () => {
  // A regra do PNG vale só nos hosts do AutoConf. Foto tratada volta como
  // /api/uploads/<uuid>.png e não pode ser descartada junto.
  const tratadas = ["/api/uploads/aaa.png", "/api/uploads/bbb.jpg"];
  assert.deepEqual(fotosParaTratamento(tratadas), tratadas);
});

test("normalizarFotos aceita string e objeto, tira repetida e lixo", () => {
  assert.deepEqual(
    normalizarFotos([
      `${BNDV_CARRO}/a.webp`,
      { url: `${BNDV_CARRO}/a.webp` },
      { url: `${BNDV_CARRO}/b.webp` },
      "javascript:alert(1)",
      "",
      null,
      { url: 42 },
    ]),
    [`${BNDV_CARRO}/a.webp`, `${BNDV_CARRO}/b.webp`],
  );
  assert.deepEqual(normalizarFotos("não é lista"), []);
});

test("pasta do veículo começa pela placa, que é o que se procura no Explorer", () => {
  assert.equal(
    pastaDoVeiculo({ plate: "DIO7790", brand: "Chevrolet", model: "Celta", version: "Life 1.0", year_model: 2008 }),
    "DIO7790 - Chevrolet Celta Life 1.0 2008",
  );
  assert.equal(pastaDoVeiculo({ internal_code: "AD-44", brand: "Fiat", model: "Argo" }), "AD-44 - Fiat Argo");
  assert.match(pastaDoVeiculo({ id: "9c1f2ab3-0000-4000-8000-000000000000" }), /^9c1f2ab3/);
  assert.equal(pastaDoVeiculo({}), "sem-placa");
});

test("parceiro vira pasta; sem parceiro é particular e estoque próprio é autodrive", () => {
  assert.equal(pastaDoParceiro({ partner_name: "Tchesco Car" }), "Tchesco Car");
  assert.equal(pastaDoParceiro({ origin_type: "PRIVATE" }), "particular");
  assert.equal(pastaDoParceiro({ origin_type: "OWN" }), "autodrive");
  assert.equal(pastaDoParceiro({}), "particular");
});

test("nome de pasta perde acento e caractere proibido no Windows", () => {
  assert.equal(limparNomeDePasta('Garagem "São João" / Filial: 2'), "Garagem Sao Joao - Filial- 2");
});

test("caminho separa tratadas de não tratadas dentro da pasta do veículo", () => {
  const veiculo = { plate: "ABC1D23", partner_name: "Now Car" };
  assert.equal(
    caminhoDoVeiculo(veiculo, "AutoDrive/estoque", "nao tratadas"),
    "AutoDrive/estoque/Now Car/ABC1D23/nao tratadas",
  );
  assert.equal(
    caminhoDoVeiculo(veiculo, "/AutoDrive/estoque/", "tratadas"),
    "AutoDrive/estoque/Now Car/ABC1D23/tratadas",
  );
});

test("arquivo mantém a ordem da galeria e normaliza a extensão", () => {
  assert.equal(nomeDaFoto(0, `${AUTOCONF}/x.jpeg`), "01.jpg");
  assert.equal(nomeDaFoto(9, `${BNDV_CARRO}/y.webp?v=2`), "10.webp");
  assert.equal(nomeDaFoto(2, "https://exemplo.com/sem-extensao"), "03.jpg");
});

test("crc32 bate com o valor conhecido de referência", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("nome dentro do ZIP não escapa da pasta ao extrair", () => {
  assert.equal(nomeSeguroNoZip("../../etc/passwd"), "etc/passwd");
  assert.equal(nomeSeguroNoZip("C:\\Windows\\system32\\a.jpg"), "C:/Windows/system32/a.jpg");
  assert.equal(nomeSeguroNoZip("/////"), "arquivo");
});

test("ZIP gerado tem assinatura, contagem e nome em UTF-8", () => {
  const conteudo = new TextEncoder().encode("foto");
  const zip = montarZip(
    [
      { nome: "ABC1D23 - Now Car/nao tratadas/01.jpg", conteudo },
      { nome: "ABC1D23 - Now Car/tratadas/01.jpg", conteudo },
    ],
    new Date("2026-09-17T12:00:00Z"),
  );

  const visao = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(visao.getUint32(0, true), 0x04034b50, "cabeçalho local do primeiro arquivo");
  assert.equal(visao.getUint32(zip.length - 22, true), 0x06054b50, "EOCD no fim");
  assert.equal(visao.getUint16(zip.length - 22 + 10, true), 2, "duas entradas no diretório central");
  assert.equal(visao.getUint16(6, true) & 0x0800, 0x0800, "bit 11 ligado para nome UTF-8");
});
