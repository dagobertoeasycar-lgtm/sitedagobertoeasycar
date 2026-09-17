import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * Gestão das fotos de um veículo.
 *
 * GET    → fotos atuais, originais guardadas e estado da trava
 * PUT    → substitui a galeria inteira (é o que o tratamento usa)
 * PATCH  → travar, destravar ou restaurar as fotos da origem
 * DELETE → remove uma foto pela URL, ou todas com ?todas=1
 *
 * A trava existe para a sincronização não devolver as fotos do parceiro por
 * cima das tratadas. Ver migration 015 e a guarda em sync-partners.mjs.
 */

const UUID = /^[0-9a-f-]{36}$/;

type MediaItem = { type: "image" | "video"; url: string };

type VehicleRow = {
  id: string;
  title: string;
  images: MediaItem[] | string[] | null;
  images_original: MediaItem[] | null;
  image_url: string | null;
  photos_locked: boolean;
  photos_status: string;
};

function normalizarLista(valor: unknown): MediaItem[] {
  const bruto = Array.isArray(valor) ? valor : [];
  const vistas = new Set<string>();
  const saida: MediaItem[] = [];
  for (const item of bruto) {
    const url = typeof item === "string" ? item : (item as MediaItem)?.url;
    if (typeof url !== "string" || !/^https?:\/\/|^\//.test(url)) continue;
    if (vistas.has(url)) continue;
    vistas.add(url);
    saida.push({ type: "image", url });
  }
  return saida;
}

async function carregar(id: string) {
  const r = await query<VehicleRow>(
    `SELECT id, title, images, images_original, image_url, photos_locked, photos_status
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  return NextResponse.json({
    id: v.id,
    title: v.title,
    fotos: normalizarLista(v.images),
    fotosOriginais: normalizarLista(v.images_original),
    capa: v.image_url,
    travada: v.photos_locked,
    situacao: v.photos_status,
  });
}

/** Substitui a galeria inteira. Guarda as originais na primeira troca. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json()) as { fotos?: unknown; travar?: boolean; situacao?: string };
  const fotos = normalizarLista(body.fotos);
  if (!fotos.length) {
    return NextResponse.json({ error: "Envie ao menos uma foto válida." }, { status: 400 });
  }

  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

  const antes = normalizarLista(v.images);
  const jaGuardou = normalizarLista(v.images_original).length > 0;
  const travar = body.travar !== false;
  const situacao = body.situacao === "EM_TRATAMENTO" ? "EM_TRATAMENTO" : travar ? "TRATADA" : "ORIGEM";

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
    [id, jaGuardou, JSON.stringify(fotos), fotos[0].url, travar, session.userId, situacao],
  );

  await registrar(id, "SUBSTITUIR", antes.length, fotos.length, session.userId, travar ? "travada" : "sem trava");
  return NextResponse.json({ id, fotos, travada: travar, situacao });
}

/** Travar, destravar ou restaurar as fotos da origem. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await request.json()) as { acao?: string };
  const v = await carregar(id);
  if (!v) return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });

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
    const originais = normalizarLista(v.images_original);
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
      [id, JSON.stringify(originais), originais[0].url],
    );
    await registrar(id, "RESTAURAR", normalizarLista(v.images).length, originais.length, session.userId);
    return NextResponse.json({ id, fotos: originais, travada: false, situacao: "ORIGEM" });
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

  const atuais = normalizarLista(v.images);
  const url = new URL(request.url);
  const todas = url.searchParams.get("todas") === "1";
  const alvo = url.searchParams.get("url") ?? "";

  const restantes = todas ? [] : atuais.filter((f) => f.url !== alvo);
  if (!todas && restantes.length === atuais.length) {
    return NextResponse.json({ error: "Foto não encontrada nesse veículo." }, { status: 404 });
  }

  const jaGuardou = normalizarLista(v.images_original).length > 0;
  await query(
    `UPDATE vehicles SET
       images_original = CASE WHEN $2 THEN images_original ELSE images END,
       images = $3::jsonb,
       image_url = $4,
       updated_at = now()
     WHERE id = $1`,
    [id, jaGuardou, JSON.stringify(restantes), restantes[0]?.url ?? null],
  );

  await registrar(id, "EXCLUIR", atuais.length, restantes.length, session.userId, todas ? "todas" : alvo);
  return NextResponse.json({ id, fotos: restantes });
}
