import { NextRequest, NextResponse } from "next/server";
import { sessionFor } from "@/lib/permissions";
import { query } from "@/lib/db";
import { normalizePricingRule } from "@/lib/pricing";
import { getPricingRule, getStockRule, savePricingRule, saveStockRule } from "@/lib/settings";

export async function GET() {
  if (!(await sessionFor("configuracoes"))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const [pricing, stock] = await Promise.all([getPricingRule(), getStockRule()]);
  return NextResponse.json({ pricing, stock });
}

export async function PUT(request: NextRequest) {
  const session = await sessionFor("configuracoes");
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const rule = normalizePricingRule(body.pricing);

  if (rule.mode === "range" && rule.max_cents < rule.min_cents) {
    return NextResponse.json({ error: "O acréscimo máximo não pode ser menor que o mínimo." }, { status: 400 });
  }

  await savePricingRule(rule);

  const stockRaw = (body.stock && typeof body.stock === "object" ? body.stock : {}) as Record<string, unknown>;
  const checks = Math.trunc(Number(stockRaw.missing_checks_before_inactive));
  if (Number.isFinite(checks) && checks >= 1) {
    await saveStockRule({ missing_checks_before_inactive: checks });
  }

  await query(
    "INSERT INTO audit_log(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'update','settings','pricing_rule',$2::jsonb)",
    [session.userId, JSON.stringify(rule)],
  );

  const [pricing, stock] = await Promise.all([getPricingRule(), getStockRule()]);
  return NextResponse.json({ pricing, stock });
}
