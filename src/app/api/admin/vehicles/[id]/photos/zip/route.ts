import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  nomeDaFoto,
  pastaDoParceiro,
  pastaDoVeiculo,
  separarFotos,
  type DadosDaPasta,
} from "@/lib/vehicle-photos";
import { montarZip, nomeSeguroNoZip, type ArquivoZip } from "@/lib/zip";

/**
 * Baixa todas as fotos de um veículo em um ZIP só.
 *
 * O arquivo sai com o nome "<PLACA> - <Parceiro>.zip" e, dentro, a mesma
 * estrutura que a extensão usa no disco:
 *
 *   PLACA - Parceiro/
 *     tratadas/01.jpg …        (só quando o veículo já foi tratado)
 *     nao tratadas/01.jpg …    (o que veio da origem)
 *
 * Assim a pasta baixada pelo painel e a pasta criada pela extensão são a mesma
 * coisa, e ninguém precisa reorganizar nada na mão.
 *
 * Arte da loja (logotipo do parceiro, composição com o nome da loja) não entra.
 *
 * GET /api/admin/vehicles/{id}/photos/zip
 */

export const runtime = "nodejs";
export const maxDuration = 120;

const UUID = /^[0-9a-f-]{36}$/;
const LIMITE_BYTES = 250 * 1024 * 1024; // ZIP maior do que isto trava o navegador

type Row = DadosDaPasta & {
  id: string;
  title: string;
  images: unknown;
  images_original: unknown;
  photos_status: string;
};

/**
 * Endereço na própria máquina ou na rede interna.
 *
 * As URLs vêm do banco, gravadas pela sincronização, então não é um campo que
 * o público preenche. Ainda assim o servidor não deve buscar nada de dentro da
 * rede por instrução de um dado armazenado: se algum dia a origem for
 * comprometida, o pior que acontece é uma foto faltando no ZIP.
 */
function ehEnderecoInterno(hostname: string) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h === "::1") return true;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  const [a, b] = h.split(".").map(Number);
  return a === 127 || a === 10 || a === 0 || a === 169 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Lê a foto, venha de onde vier.
 *
 * Foto tratada mora no Vercel Blob (endereço absoluto) e foto de parceiro no
 * CDN da origem. Galeria antiga ainda guarda caminho relativo
 * `/api/uploads/<arquivo>`, que resolve contra o próprio site — por isso o
 * endereço do próprio site é exceção à recusa de rede interna: em
 * desenvolvimento ele é 127.0.0.1, e recusar ali deixaria o ZIP vazio.
 */
async function baixar(url: string, site: string) {
  const alvo = /^https?:\/\//i.test(url) ? url : new URL(url, site).toString();
  const proprio = (endereco: string) => endereco.startsWith(new URL(site).origin);
  if (!proprio(alvo) && ehEnderecoInterno(new URL(alvo).hostname)) return null;

  const resposta = await fetch(alvo, { redirect: "follow" });
  if (!resposta.ok) return null;
  if (!proprio(resposta.url) && ehEnderecoInterno(new URL(resposta.url).hostname)) return null;
  return new Uint8Array(await resposta.arrayBuffer());
}

async function juntar(urls: string[], pasta: string, dentro: ArquivoZip[], falhas: string[], site: string) {
  let bytes = 0;
  for (let i = 0; i < urls.length; i++) {
    try {
      const conteudo = await baixar(urls[i], site);
      if (!conteudo) {
        falhas.push(urls[i]);
        continue;
      }
      bytes += conteudo.length;
      dentro.push({ nome: `${pasta}/${nomeDaFoto(i, urls[i])}`, conteudo });
    } catch {
      falhas.push(urls[i]);
    }
  }
  return bytes;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const r = await query<Row>(
    `SELECT v.id, v.title, v.brand, v.model, v.version, v.year_model, v.plate,
            v.internal_code, v.origin_type, v.images, v.images_original, v.photos_status,
            p.name AS partner_name
       FROM vehicles v
       LEFT JOIN partners p ON p.id = v.partner_id
      WHERE v.id = $1 LIMIT 1`,
    [id],
  );
  const v = r.rows[0];
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  const atuais = separarFotos(v.images).fotos;
  const originais = separarFotos(v.images_original).fotos;
  const tratado = v.photos_status === "TRATADA" && originais.length > 0;

  const raiz = `${pastaDoVeiculo(v)} - ${pastaDoParceiro(v)}`;
  const dentro: ArquivoZip[] = [];
  const falhas: string[] = [];

  const site = new URL(request.url).origin;
  let bytes = await juntar(atuais, `${raiz}/${tratado ? "tratadas" : "nao tratadas"}`, dentro, falhas, site);
  if (tratado) bytes += await juntar(originais, `${raiz}/nao tratadas`, dentro, falhas, site);

  if (!dentro.length) {
    return NextResponse.json(
      { error: "Nenhuma foto pôde ser baixada. Verifique se a origem ainda publica as imagens." },
      { status: 502 },
    );
  }
  if (bytes > LIMITE_BYTES) {
    return NextResponse.json(
      { error: "As fotos deste veículo passam de 250 MB. Baixe pela extensão, que grava direto no disco." },
      { status: 413 },
    );
  }

  // Um aviso dentro do ZIP é melhor do que uma pasta com buraco silencioso.
  if (falhas.length) {
    dentro.push({
      nome: `${raiz}/FOTOS-QUE-FALHARAM.txt`,
      conteudo: new TextEncoder().encode(
        `Estas fotos não responderam no momento do download:\n\n${falhas.join("\n")}\n`,
      ),
    });
  }

  const zip = montarZip(dentro);
  const arquivo = nomeSeguroNoZip(`${raiz}.zip`);
  return new NextResponse(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": `attachment; filename="fotos.zip"; filename*=UTF-8''${encodeURIComponent(arquivo)}`,
      "Cache-Control": "no-store",
    },
  });
}
