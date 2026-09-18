/**
 * Regras de foto de veículo, em um lugar só.
 *
 * O site, a sincronização (scripts/*.mjs) e a extensão do Chrome precisam
 * concordar sobre três coisas:
 *
 *   1. o que é foto do CARRO e o que é arte da LOJA de origem
 *   2. como se chama a pasta de um veículo no disco
 *   3. quais fotos entram na fila de tratamento
 *
 * Se cada um tivesse a sua cópia da regra, a extensão baixaria uma foto que o
 * site já descartou — e o operador ficaria tratando material que não vai para
 * lugar nenhum. Por isso os scripts em Node importam este arquivo direto
 * (Node 24 remove os tipos sozinho), igual os testes já fazem com outros libs.
 *
 * ── Como a arte da loja foi identificada (17/09/2026) ──────────────────────
 *
 * Now Car (conector bndv_html): a página de detalhe não traz foto nenhuma no
 * HTML do servidor — as fotos entram por JavaScript. O que sobra no HTML é
 * `sites-logo/clientes/766/logo.jpeg`, o logotipo da loja. O conector pegava
 * esse logotipo e substituía as fotos boas da listagem por ele.
 *
 * Tchesco Car e EasyCar (conector autoconf): a PRIMEIRA foto da galeria é a
 * composição de marketing da loja — fundo de estúdio, logotipo "TCHESCOCAR
 * MULTIMARCAS", tapa-placa com a marca, às vezes uma tarja "CARRO DE REPASSE"
 * ou "7 LUGARES". Ela sempre sai em .png, enquanto a câmera da loja entrega
 * .jpeg. Conferido abrindo as imagens de 19 veículos.
 *
 * O detalhe que derrubou a primeira versão desta regra: "todo .png é arte"
 * está ERRADO. O veículo 1077701 (Jeep Commander) tem 24 fotos, todas .png, e
 * só a primeira é arte — as outras 23 são foto crua de interior e lataria,
 * exportadas em png pela loja. Descartar por extensão apagaria 23 fotos boas.
 *
 * Daí a regra em duas partes:
 *   · a primeira foto em .png é arte, sempre (é a capa, é o que incomodava);
 *   · .png no meio da galeria só é arte quando .png é MINORIA ali — se a
 *     galeria inteira é png, a loja só exporta nesse formato.
 */

export type MediaItem = { type: "image"; url: string };

/** Hosts em que o .png é arte de marketing, e não foto tirada do carro. */
const HOSTS_AUTOCONF = [
  "autoconf-production.s3.amazonaws.com",
  "resized-images.autoconf.com.br",
  "static.autoconf.com.br",
];

/** Caminhos que nunca são foto de carro, em qualquer origem. */
const CAMINHOS_DE_MARCA = [
  /\/sites-logo\//i, // BNDV: logotipo do lojista
  /\/sites-banners\//i, // BNDV: banner de campanha
  /\/logo[.\-_]/i,
  /\/banner[s]?[.\-_/]/i,
  /marca[-_ ]?d.?agua/i,
  /watermark/i,
];

function host(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function extensao(url: string) {
  const semQuery = url.split(/[?#]/)[0];
  return (semQuery.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
}

/** Logotipo, banner ou marca d'água: nunca é foto do carro, sozinho ou não. */
export function ehMarcaDaLoja(url: string) {
  return CAMINHOS_DE_MARCA.some((padrao) => padrao.test(url));
}

/**
 * Normaliza uma lista de mídia vinda do banco, da API de origem ou do form.
 * Aceita string ou { url }, descarta o que não é endereço e tira repetida.
 */
export function normalizarFotos(valor: unknown): string[] {
  const bruto = Array.isArray(valor) ? valor : [];
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const item of bruto) {
    const url = typeof item === "string" ? item : (item as { url?: unknown })?.url;
    if (typeof url !== "string") continue;
    const limpa = url.trim();
    if (!/^https?:\/\//i.test(limpa) && !limpa.startsWith("/")) continue;
    if (vistas.has(limpa)) continue;
    vistas.add(limpa);
    saida.push(limpa);
  }
  return saida;
}

/**
 * Separa a galeria em foto do carro e arte da loja.
 *
 * A regra do PNG só vale nos hosts do AutoConf. Foto tratada por nós volta
 * como /api/uploads/<uuid>.png e não pode ser descartada por causa disso.
 */
export function separarFotos(valor: unknown): { fotos: string[]; artesDaLoja: string[] } {
  const todas = normalizarFotos(valor);
  const ehPngDoAutoconf = (url: string) => HOSTS_AUTOCONF.includes(host(url)) && extensao(url) === "png";

  // Minoria de png: sinal de que o png é a exceção na galeria, e exceção no
  // AutoConf quer dizer arte de marketing. Galeria toda em png é só o formato
  // que a loja escolheu exportar.
  const pngs = todas.filter(ehPngDoAutoconf).length;
  const pngEhExcecao = pngs > 0 && pngs * 2 < todas.length;

  const fotos: string[] = [];
  const artesDaLoja: string[] = [];

  for (let i = 0; i < todas.length; i++) {
    const url = todas[i];
    const capaDaLoja = i === 0 && ehPngDoAutoconf(url);
    const arteNoMeio = i > 0 && pngEhExcecao && ehPngDoAutoconf(url);
    if (ehMarcaDaLoja(url) || capaDaLoja || arteNoMeio) artesDaLoja.push(url);
    else fotos.push(url);
  }

  return { fotos, artesDaLoja };
}

/**
 * O que o site deve publicar.
 *
 * Arte da loja sai da galeria. A exceção é o veículo cuja origem só mandou
 * arte: ficar sem imagem nenhuma seria pior do que mostrar a composição, então
 * ela fica até alguém subir foto de verdade pelo painel.
 */
export function fotosPublicaveis(valor: unknown): string[] {
  const { fotos, artesDaLoja } = separarFotos(valor);
  return fotos.length ? fotos : artesDaLoja;
}

/** O que vai para tratamento. Arte da loja nunca entra, nem como último recurso. */
export function fotosParaTratamento(valor: unknown): string[] {
  return separarFotos(valor).fotos;
}

/**
 * Tira acento e caractere proibido em nome de arquivo no Windows.
 *
 * Separador (\ / :) vira hífen porque costuma separar mesmo ("Loja/Filial 2").
 * Aspas e coringas simplesmente somem: virar hífen só deixaria o nome feio.
 */
export function limparNomeDePasta(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/["*?<>|]/g, "")
    .replace(/[\\/:]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-\s]+|[-\s]+$/g, "");
}

export type DadosDaPasta = {
  plate?: string | null;
  internal_code?: string | null;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  year_model?: number | null;
  partner_name?: string | null;
  origin_type?: string | null;
  id?: string | null;
};

/**
 * Nome da pasta do parceiro. Veículo sem parceiro cai em "particular", que é
 * como o painel chama a origem PRIVATE, e estoque próprio vai para "autodrive".
 */
export function pastaDoParceiro(v: DadosDaPasta) {
  if (v.partner_name) return limparNomeDePasta(v.partner_name).slice(0, 80);
  if (v.origin_type === "OWN") return "autodrive";
  return "particular";
}

/**
 * Nome da pasta do veículo: "PLACA - Marca Modelo Versao Ano".
 *
 * A placa vem primeiro porque é o que o operador procura no Explorer. Sem
 * placa, entra o código interno; sem os dois, o começo do id — sempre único,
 * nunca duas pastas iguais para carros diferentes.
 */
export function pastaDoVeiculo(v: DadosDaPasta) {
  const chave = limparNomeDePasta(v.plate || v.internal_code || (v.id || "").slice(0, 8)) || "sem-placa";
  const descricao = limparNomeDePasta(
    [v.brand, v.model, v.version, v.year_model].filter(Boolean).join(" "),
  );
  return `${chave}${descricao ? ` - ${descricao}` : ""}`.slice(0, 120);
}

/** Caminho completo, do jeito que a extensão grava dentro de Downloads. */
export function caminhoDoVeiculo(v: DadosDaPasta, raiz: string, subpasta: "tratadas" | "nao tratadas") {
  const base = String(raiz || "").replace(/^\/+|\/+$/g, "");
  return [base, pastaDoParceiro(v), pastaDoVeiculo(v), subpasta].filter(Boolean).join("/");
}

/** Nome do arquivo dentro da pasta: 01.jpg, 02.jpg… mantém a ordem da galeria. */
export function nomeDaFoto(indice: number, url: string) {
  const ext = extensao(url);
  const valida = ["jpg", "jpeg", "png", "webp", "avif"].includes(ext) ? ext : "jpg";
  return `${String(indice + 1).padStart(2, "0")}.${valida === "jpeg" ? "jpg" : valida}`;
}
