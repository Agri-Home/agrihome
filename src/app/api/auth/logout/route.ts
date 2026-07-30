import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth/session";
import { shouldUseSecureSessionCookie } from "@/lib/auth/web-sign-in";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return clearSessionCookie(NextResponse.json({ ok: true }), {
    secure: shouldUseSecureSessionCookie(request)
  });
}
