import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { imageUploadMaxBytes, saveImageFile } from "@/lib/image-upload";
import { isVercelBlobUrl } from "@/lib/media-upload";
import { readDefaultVehicleVideo } from "@/lib/default-vehicle-video";
import { mesmasFotos, normalizarFotos, separarFotos, type MediaItem } from "@/lib/vehicle-photos";

/**
 * Gestão das fotos de um veículo.
 *
 * GET    → fotos atuais, arte da loja descartada, originais e estado da trava
 * POST   → sobe arquivos novos (multipart) e ACRESCENTA à galeria
 * PUT    → substitui a galeria inteira (é o que o tratamento usa)
 * PATCH  → travar, destravar ou restaurar as fotos da origem
 * DELETE → remove uma foto pela URL, ou todas com ?todas=1
 *
 * A trava existe para a sincronização não devolver as fotos do parceiro por
 * cima das tratadas. Ver migration 015 e a guarda em sync-partners.mjs.
 *
 * Quem sobe foto pelo painel (POST) trava o veículo: foi trabalho manual, o
 * sync não pode desfazer no ciclo seguinte.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/;
const MAX_ARQUIVOS = 40;

type VehicleRow = {
  id: string;
  title: string;
  images: MediaItem[] | string[] | null;
  images_original: MediaItem[] | null;
  image_url: string | null;
  photos_locked: boolean;
  photos_status: string;
  video_url: string | null;
};

function comoMedia(urls: string[]): MediaItem[] {
  return urls.map((url) => ({ type: "image", url }));
}

async function carregar(id: string) {
  const r = await query<VehicleRow>(
    `SELECT id, title, images, images_original, image_url, photos_locked, photos_status, video_url
       FROM vehicles WHERE id = $1 LIMIT 1`,
    [id],
  );
  return r.rows[0] ?? null;
}

async function registrar(vehicleId: string, acao: string, antes: number, depois: number, quem: string, obs = "") {
  await query(
    `INSERT INTO vehicle_photo_runs(vehicle_id, acao, fotos_antes, fotos_depois, feito_por, observacao)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [vehicleId, acao, antes, depois, quem, obs],
  ).catch(() => undefined);
}

/** Grava a galeria nova mantendo a cópia das originais da primeira troca. */
async function gravarGaleria(
  id: string,
  atual: VehicleRow,
  fotos: string[],
  opcoes: { travar: boolean; situacao: string; userId: string },
) {
  const jaGuardou = normalizarFotos(atual.images_original).length > 0;
  await query(
    `UPDATE vehicles SET
       images_original = CASE WHEN $2 THEN images_original ELSE images END,
       images = $3::jsonb,
       image_url = $4,
       photos_locked = $5,
       photos_locked_at = CASE WHEN $5 THEN now() ELSE NULL END,
       photos_locked_by = CASE WHEN $5 THEN $6 ELSE NULL END,
       photos_status = $7,
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      jaGuardou,
      JSON.stringify(comoMedia(fotos)),
      fotos[0] ?? null,
      opcoes.travar,
      opcoes.userId,
      opcoes.situacao,
    ],
  );
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  const defaultVideo = await readDefaultVehicleVideo().catch(() => ({ url: "", enabled: false, effectiveUrl: "" }));

  const { fotos, artesDaLoja } = separarFotos(v.images);
  return NextResponse.json({
    id: v.id,
    title: v.title,
    fotos: comoMedia(fotos),
    artesDaLoja: comoMedia(artesDaLoja),
    fotosOriginais: comoMedia(normalizarFotos(v.images_original)),
    capa: v.image_url,
    travada: v.photos_locked,
    situacao: v.photos_status,
    videoUrl: v.video_url || "",
    defaultVideoUrl: defaultVideo.url,
    defaultVideoEnabled: defaultVideo.enabled,
  });
}

/** Sobe arquivos do computador e acrescenta ao fim da galeria. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  const form = await request.formData();
  const enviados = form.getAll("fotos").filter((item): item is File => item instanceof File && item.size > 0);
  if (!enviados.length) return NextResponse.json({ error: "Nenhuma foto enviada." }, { status: 400 });
  if (enviados.length > MAX_ARQUIVOS) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_ARQUIVOS} fotos por vez.` }, { status: 400 });
  }

  const novas: string[] = [];
  const recusadas: string[] = [];
  for (const arquivo of enviados) {
    if (arquivo.size > imageUploadMaxBytes) {
      recusadas.push(`${arquivo.name}: acima de ${Math.round(imageUploadMaxBytes / 1024 / 1024)} MB`);
      continue;
    }
    try {
      novas.push((await saveImageFile(arquivo)).url);
    } catch (error) {
      recusadas.push(`${arquivo.name}: ${error instanceof Error ? error.message : "falhou"}`);
    }
  }
  if (!novas.length) {
    return NextResponse.json({ error: `Nenhuma foto aceita. ${recusadas.join("; ")}` }, { status: 400 });
  }

  // Substituir: a foto que o operador subiu vale mais do que a arte do
  // parceiro, mas a arte só sai se sobrar foto de verdade na galeria.
  const { fotos, artesDaLoja } = separarFotos(v.images);
  const antes = fotos.length + artesDaLoja.length;
  const galeria = normalizarFotos([...fotos, ...novas]);

  await gravarGaleria(id, v, galeria, {
    travar: true,
    situacao: v.photos_status === "ORIGEM" ? "EM_TRATAMENTO" : v.photos_status,
    userId: session.userId,
  });
  await registrar(id, "ADICIONAR", antes, galeria.length, session.userId, `${novas.length} enviada(s) pelo painel`);

  return NextResponse.json(
    { id, fotos: comoMedia(galeria), adicionadas: novas.length, recusadas, travada: true },
    { status: 201 },
  );
}

/** Substitui a galeria inteira. Guarda as originais na primeira troca. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json()) as { fotos?: unknown; travar?: boolean; situacao?: string };
  const fotos = normalizarFotos(body.fotos);
  if (!fotos.length) {
    return NextResponse.json({ error: "Envie ao menos uma foto válida." }, { status: 400 });
  }

  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  const antes = normalizarFotos(v.images);
  const travar = body.travar !== false;
  const situacao = body.situacao === "EM_TRATAMENTO" ? "EM_TRATAMENTO" : travar ? "TRATADA" : "ORIGEM";

  await gravarGaleria(id, v, fotos, { travar, situacao, userId: session.userId });
  await registrar(id, "SUBSTITUIR", antes.length, fotos.length, session.userId, travar ? "travada" : "sem trava");
  return NextResponse.json({ id, fotos: comoMedia(fotos), travada: travar, situacao });
}

/** Travar, destravar ou restaurar as fotos da origem. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json()) as { acao?: string; fotos?: unknown; url?: unknown };
  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  if (body.acao === "adicionar") {
    const novas = normalizarFotos(body.fotos).filter((url) => isVercelBlobUrl(url, "vehicle-images"));
    if (!novas.length) return NextResponse.json({ error: "Nenhuma foto válida foi enviada." }, { status: 400 });
    const atuais = separarFotos(v.images).fotos;
    const galeria = normalizarFotos([...atuais, ...novas]);
    await gravarGaleria(id, v, galeria, {
      travar: true,
      situacao: v.photos_status === "ORIGEM" ? "EM_TRATAMENTO" : v.photos_status,
      userId: session.userId,
    });
    await registrar(id, "ADICIONAR", atuais.length, galeria.length, session.userId, `${novas.length} enviada(s) direto ao Blob`);
    return NextResponse.json({ id, fotos: comoMedia(galeria), travada: true });
  }

  if (body.acao === "reordenar") {
    const ordem = normalizarFotos(body.fotos);
    const atuais = separarFotos(v.images).fotos;
    if (!mesmasFotos(atuais, ordem)) {
      return NextResponse.json({ error: "A nova ordem precisa conter exatamente as fotos atuais." }, { status: 400 });
    }
    await query(
      `UPDATE vehicles SET images=$2::jsonb, image_url=$3,
         photos_locked=true, photos_locked_at=now(), photos_locked_by=$4, updated_at=now()
       WHERE id=$1`,
      [id, JSON.stringify(comoMedia(ordem)), ordem[0] ?? null, session.userId],
    );
    await registrar(id, "REORDENAR", atuais.length, ordem.length, session.userId, "ordem manual salva");
    return NextResponse.json({ id, fotos: comoMedia(ordem), travada: true });
  }

  if (body.acao === "definir-video") {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!isVercelBlobUrl(url, "vehicle-videos")) {
      return NextResponse.json({ error: "Vídeo inválido." }, { status: 400 });
    }
    await query("UPDATE vehicles SET video_url=$2, updated_at=now() WHERE id=$1", [id, url]);
    await query(
      "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'video','vehicle',$2,$3::jsonb)",
      [session.userId, id, JSON.stringify({ url })],
    ).catch(() => undefined);
    return NextResponse.json({ id, videoUrl: url });
  }

  if (body.acao === "usar-video-padrao") {
    await query("UPDATE vehicles SET video_url=NULL, updated_at=now() WHERE id=$1", [id]);
    await query(
      "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'video_padrao','vehicle',$2,'{}'::jsonb)",
      [session.userId, id],
    ).catch(() => undefined);
    return NextResponse.json({ id, videoUrl: "" });
  }

  if (body.acao === "travar" || body.acao === "destravar") {
    const travar = body.acao === "travar";
    await query(
      `UPDATE vehicles SET
         photos_locked = $2,
         photos_locked_at = CASE WHEN $2 THEN now() ELSE NULL END,
         photos_locked_by = CASE WHEN $2 THEN $3 ELSE NULL END,
         updated_at = now()
       WHERE id = $1`,
      [id, travar, session.userId],
    );
    await registrar(id, travar ? "TRAVAR" : "DESTRAVAR", 0, 0, session.userId);
    return NextResponse.json({ id, travada: travar });
  }

  if (body.acao === "restaurar") {
    // Restaurar volta ao que a origem mandou, mas a arte da loja continua
    // fora: ela nunca deveria ter entrado na galeria.
    const originais = separarFotos(v.images_original).fotos;
    if (!originais.length) {
      return NextResponse.json(
        { error: "Este veículo não tem fotos originais guardadas para restaurar." },
        { status: 409 },
      );
    }
    await query(
      `UPDATE vehicles SET
         images = $2::jsonb, image_url = $3,
         photos_locked = false, photos_locked_at = NULL, photos_locked_by = NULL,
         photos_status = 'ORIGEM', updated_at = now()
       WHERE id = $1`,
      [id, JSON.stringify(comoMedia(originais)), originais[0]],
    );
    await registrar(id, "RESTAURAR", normalizarFotos(v.images).length, originais.length, session.userId);
    return NextResponse.json({ id, fotos: comoMedia(originais), travada: false, situacao: "ORIGEM" });
  }

  return NextResponse.json({ error: "Ação inválida. Use travar, destravar ou restaurar." }, { status: 400 });
}

/** Remove uma foto pela URL, ou todas com ?todas=1. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  const atuais = normalizarFotos(v.images);
  const url = new URL(request.url);
  const todas = url.searchParams.get("todas") === "1";
  const alvo = url.searchParams.get("url") ?? "";

  const restantes = todas ? [] : atuais.filter((foto) => foto !== alvo);
  if (!todas && restantes.length === atuais.length) {
    return NextResponse.json({ error: "Foto não encontrada nesse veículo." }, { status: 404 });
  }

  const jaGuardou = normalizarFotos(v.images_original).length > 0;
  await query(
    `UPDATE vehicles SET
       images_original = CASE WHEN $2 THEN images_original ELSE images END,
       images = $3::jsonb,
       image_url = $4,
       updated_at = now()
     WHERE id = $1`,
    [id, jaGuardou, JSON.stringify(comoMedia(restantes)), restantes[0] ?? null],
  );

  await registrar(id, "EXCLUIR", atuais.length, restantes.length, session.userId, todas ? "todas" : alvo);
  return NextResponse.json({ id, fotos: comoMedia(restantes) });
}
