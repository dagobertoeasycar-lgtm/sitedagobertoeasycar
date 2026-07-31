import { NextRequest, NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";
import { publicUrl } from "@/lib/public-url";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(publicUrl("/admin/login", request.url), 303);
  response.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return response;
}
