import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { safeMailError, sendLeadNotification } from "@/lib/email";
import { formatCnpj, isValidCnpj } from "@/lib/cnpj";

const kinds = new Set(["contact", "financing", "sell_car", "wholesale"]);
export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000) return NextResponse.json({ error: "Solicitação muito grande" }, { status: 413 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const message = String(body?.message ?? "").trim();
  const kind = String(body?.kind ?? "");
  const companyName = String(body?.companyName ?? "").trim();
  const cnpj = String(body?.cnpj ?? "").trim();
  const emailIsValid = email === "" || (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const phoneDigits = phone.replace(/\D/g, "");
  const isWholesale = kind === "wholesale";
  const resolvedName = isWholesale ? companyName : name;
  const resolvedMessage = isWholesale ? "Solicitação de cadastro para compras no atacado." : message;
  const baseIsInvalid = !kinds.has(kind) || resolvedName.length < 2 || resolvedName.length > 160 || phone.length > 30 || phoneDigits.length < 10 || phoneDigits.length > 13 || !emailIsValid || resolvedMessage.length < 2 || resolvedMessage.length > 2000 || body?.consent !== "yes";
  if (baseIsInvalid) return NextResponse.json({ error: "Preencha corretamente todos os campos obrigatórios." }, { status: 400 });
  if (isWholesale && (!email || !isValidCnpj(cnpj))) return NextResponse.json({ error: "Informe um CNPJ válido e um e-mail válido." }, { status: 400 });

  const normalizedCnpj = isWholesale ? formatCnpj(cnpj) : null;
  const inserted = await query<{ id: string }>(
    "insert into leads(kind, name, company_name, cnpj, email, phone, message, consent_at) values ($1,$2,$3,$4,$5,$6,$7,now()) returning id",
    [kind, resolvedName, isWholesale ? companyName : null, normalizedCnpj, email || null, phone, resolvedMessage],
  );
  try {
    await sendLeadNotification({
      id: inserted.rows[0].id,
      kind: kind as "contact" | "financing" | "sell_car" | "wholesale",
      name: resolvedName,
      email,
      phone,
      message: resolvedMessage,
      companyName: isWholesale ? companyName : undefined,
      cnpj: normalizedCnpj || undefined,
    });
  } catch (error) {
    console.error("Falha ao notificar novo lead por SMTP", safeMailError(error));
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
