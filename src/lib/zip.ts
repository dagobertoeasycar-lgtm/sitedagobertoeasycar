/**
 * Gerador de ZIP sem dependência externa.
 *
 * Só o método "store" (sem compressão), porque o que vai dentro é JPEG e PNG:
 * já estão comprimidos, e deflate gastaria CPU para economizar quase nada.
 *
 * Formato: APPNOTE.TXT 6.3.3 da PKWARE. Escreve cabeçalho local + dados por
 * arquivo, depois o diretório central e o EOCD. Nomes em UTF-8, sinalizado no
 * bit 11 das flags — sem isso o Explorer do Windows erra os acentos.
 *
 * Limite: 4 GB e 65.535 arquivos (sem Zip64). Uma pasta de fotos de um carro
 * fica em poucas dezenas de MB, bem longe disso.
 */

export type ArquivoZip = { nome: string; conteudo: Uint8Array };

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[i] = c >>> 0;
  }
  return tabela;
})();

export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Data/hora no formato MS-DOS que o ZIP usa desde 1989. */
function dataDos(quando: Date) {
  const ano = Math.max(1980, quando.getFullYear());
  const data = ((ano - 1980) << 9) | ((quando.getMonth() + 1) << 5) | quando.getDate();
  const hora = (quando.getHours() << 11) | (quando.getMinutes() << 5) | (quando.getSeconds() >> 1);
  return { data, hora };
}

/**
 * Sanitiza o nome dentro do ZIP: sem caminho absoluto, sem "..", sem
 * contrabarra. Um nome montado a partir de dado do banco não pode virar
 * escrita fora da pasta quando o usuário extrair.
 */
export function nomeSeguroNoZip(nome: string) {
  const limpo = String(nome)
    .replace(/\\/g, "/")
    .split("/")
    .filter((parte) => parte && parte !== "." && parte !== "..")
    .join("/")
    .replace(/^\/+/, "");
  return limpo || "arquivo";
}

export function montarZip(arquivos: ArquivoZip[], quando = new Date()): Uint8Array {
  const { data, hora } = dataDos(quando);
  const utf8 = new TextEncoder();

  const locais: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let deslocamento = 0;

  for (const arquivo of arquivos) {
    const nome = utf8.encode(nomeSeguroNoZip(arquivo.nome));
    const conteudo = arquivo.conteudo;
    const soma = crc32(conteudo);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // assinatura
    local.setUint16(4, 20, true); // versão necessária
    local.setUint16(6, 0x0800, true); // bit 11: nome em UTF-8
    local.setUint16(8, 0, true); // método: store
    local.setUint16(10, hora, true);
    local.setUint16(12, data, true);
    local.setUint32(14, soma, true);
    local.setUint32(18, conteudo.length, true);
    local.setUint32(22, conteudo.length, true);
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true); // sem campo extra
    locais.push(new Uint8Array(local.buffer), nome, conteudo);

    const entrada = new DataView(new ArrayBuffer(46));
    entrada.setUint32(0, 0x02014b50, true);
    entrada.setUint16(4, 20, true); // versão que gerou
    entrada.setUint16(6, 20, true); // versão necessária
    entrada.setUint16(8, 0x0800, true);
    entrada.setUint16(10, 0, true);
    entrada.setUint16(12, hora, true);
    entrada.setUint16(14, data, true);
    entrada.setUint32(16, soma, true);
    entrada.setUint32(20, conteudo.length, true);
    entrada.setUint32(24, conteudo.length, true);
    entrada.setUint16(28, nome.length, true);
    entrada.setUint32(42, deslocamento, true);
    central.push(new Uint8Array(entrada.buffer), nome);

    deslocamento += 30 + nome.length + conteudo.length;
  }

  const tamanhoCentral = central.reduce((soma, parte) => soma + parte.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamanhoCentral, true);
  fim.setUint32(16, deslocamento, true);

  const partes = [...locais, ...central, new Uint8Array(fim.buffer)];
  const total = partes.reduce((soma, parte) => soma + parte.length, 0);
  const saida = new Uint8Array(total);
  let posicao = 0;
  for (const parte of partes) {
    saida.set(parte, posicao);
    posicao += parte.length;
  }
  return saida;
}
