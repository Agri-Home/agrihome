import { NextResponse } from "next/server";

import { createSessionResponse } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as { idToken?: unknown } | null;
  const idToken = typeof payload?.idToken === "string" ? payload.idToken : "";

  if (!idToken) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  try {
    return await createSessionResponse(idToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create session.";
    const status = message.includes("configured") ? 500 : 401;

    return NextResponse.json({ error: message }, { status });
  }
}
