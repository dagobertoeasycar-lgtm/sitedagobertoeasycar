import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";
import { query } from "@/lib/db";

const statuses = ["draft", "published", "paused", "sold"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = await request.json() as { status?: string };
  if (!body.status || !statuses.includes(body.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  const result = await query<{ id: string }>("update vehicles set status=$1, updated_at=now() where id=$2 returning id", [body.status, id]);
  if (!result.rowCount) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  await query("insert into audit_log(actor_id,action,entity_type,entity_id,metadata) values($1,'status','vehicle',$2,$3::jsonb)", [session.userId, id, JSON.stringify({ status: body.status })]);
  return NextResponse.json({ id, status: body.status });
}
