import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
