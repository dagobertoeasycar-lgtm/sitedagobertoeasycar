import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { pastaDoParceiro, pastaDoVeiculo, separarFotos } from "@/lib/vehicle-photos";

/**
 * Fila de tratamento de fotos, consumida pela extensão do Chrome.
 *
 * Devolve os veículos publicados cujas fotos ainda são as da origem e que não
 * estão travados. A extensão baixa essas fotos, trata e devolve pela API
 * /api/admin/vehicles/{id}/photos, que grava e trava.
 *
 * A galeria vem separada: `fotos` é o que vai para tratamento e `artesDaLoja`
 * é o que foi descartado (logotipo do parceiro, composição com o nome da loja).
 * A extensão não baixa arte da loja — ver src/lib/vehicle-photos.ts.
 *
 * Autenticação: usa a mesma sessão de administrador do painel. A extensão roda
 * no navegador onde você já está logado, então o cookie viaja junto e não há
 * token novo para guardar em lugar nenhum.
 *
 * GET /api/admin/photo-queue?limite=10&parceiro=<uuid>&situacao=ORIGEM
 */

type FilaRow = {
  id: string;
  internal_code: string | null;
  title: string;
  brand: string;
  model: string;
  version: string;
  year_model: number;
  plate: string | null;
  slug: string;
  partner_name: string | null;
  origin_type: string | null;
  images: unknown;
  photos_status: string;
  photos_locked: boolean;
  source_url: string | null;
  created_at: Date;
};

export async function GET(request: NextRequest) {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const limite = Math.min(Math.max(parseInt(sp.get("limite") || "10", 10) || 10, 1), 100);
  const parceiro = sp.get("parceiro");
  const situacao = sp.get("situacao");

  const condicoes = ["v.status = 'published'", "v.photos_locked = false"];
  const params: unknown[] = [];
  let i = 1;

  if (situacao && ["ORIGEM", "EM_TRATAMENTO", "TRATADA"].includes(situacao)) {
    condicoes.push(`v.photos_status = $${i}`);
    params.push(situacao);
    i++;
  } else {
    condicoes.push("v.photos_status = 'ORIGEM'");
  }

  if (parceiro && /^[0-9a-f-]{36}$/.test(parceiro)) {
    condicoes.push(`v.partner_id = $${i}`);
    params.push(parceiro);
    i++;
  }

  // Carro sem foto nenhuma não tem o que tratar.
  condicoes.push("v.image_url is not null and v.image_url <> ''");

  let rows: FilaRow[] = [];
  try {
    const r = await query<FilaRow>(
      `SELECT v.id, v.internal_code, v.title, v.brand, v.model, v.version, v.year_model,
              v.plate, v.slug, p.name AS partner_name, v.origin_type, v.images, v.photos_status,
              v.photos_locked, v.source_url, v.created_at
         FROM vehicles v
         LEFT JOIN partners p ON p.id = v.partner_id
        WHERE ${condicoes.join(" AND ")}
        ORDER BY v.created_at DESC
        LIMIT $${i}`,
      [...params, limite],
    );
    rows = r.rows;
  } catch (error) {
    // Banco sem a migration 015 responde com erro claro em vez de 500 cru.
    const falha = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json(
      { error: `Não foi possível ler a fila: ${falha}. Rode npm run db:migrate.` },
      { status: 503 },
    );
  }

  const fila = rows.map((v) => {
    const { fotos, artesDaLoja } = separarFotos(v.images);
    return {
      id: v.id,
      codigo: v.internal_code,
      titulo: v.title,
      marca: v.brand,
      modelo: v.model,
      versao: v.version,
      ano: v.year_model,
      placa: v.plate,
      parceiro: v.partner_name,
      origem: v.origin_type,
      pastaParceiro: pastaDoParceiro(v),
      pastaVeiculo: pastaDoVeiculo(v),
      situacao: v.photos_status,
      anuncioOriginal: v.source_url,
      paginaAdmin: `/admin/veiculos?q=${encodeURIComponent(v.title)}`,
      fotos,
      artesDaLoja,
    };
  });

  const veiculos = fila.filter((v) => v.fotos.length > 0);
  return NextResponse.json({
    total: veiculos.length,
    limite,
    // Quantos foram deixados de fora por só terem arte da loja: aparece no
    // painel da extensão para o operador não achar que a fila sumiu.
    semFotoPropria: fila.length - veiculos.length,
    artesIgnoradas: fila.reduce((soma, v) => soma + v.artesDaLoja.length, 0),
    veiculos,
  });
}
