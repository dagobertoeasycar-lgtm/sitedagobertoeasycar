import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { currentSession } from "@/lib/auth";

async function isAdmin() {
  return Boolean(await currentSession());
}

type BannerPayload = {
  id: number;
  title: string;
  image_url: string;
  link_url: string;
  link_target: "_self" | "_blank";
  sort_order: number;
  active: boolean;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro interno";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await query("SELECT * FROM banners ORDER BY sort_order ASC, id ASC");
    return NextResponse.json(result.rows);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Partial<BannerPayload>;
    const { title = "", image_url, link_url = "", link_target = "_self", sort_order = 0, active = true } = body;
    if (!image_url) return NextResponse.json({ error: "image_url obrigatório" }, { status: 400 });
    const result = await query(
      "INSERT INTO banners (title, image_url, link_url, link_target, sort_order, active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [title, image_url, link_url, link_target, sort_order, active]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Partial<BannerPayload>;
    const { id, title, image_url, link_url, link_target, sort_order, active } = body;
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const result = await query(
      `UPDATE banners SET title=COALESCE($2,title), image_url=COALESCE($3,image_url),
       link_url=COALESCE($4,link_url), link_target=COALESCE($5,link_target),
       sort_order=COALESCE($6,sort_order), active=COALESCE($7,active), updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, title, image_url, link_url, link_target, sort_order, active]
    );
    return NextResponse.json(result.rows[0]);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = (await req.json()) as Pick<BannerPayload, "id">;
    await query("DELETE FROM banners WHERE id=$1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
