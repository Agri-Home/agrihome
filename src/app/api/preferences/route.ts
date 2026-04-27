import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import {
  getParticipateMlFeedback,
  setParticipateMlFeedback
} from "@/lib/services/user-preferences-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const u = await requireApiAccountUser();
  if (u instanceof Response) {
    return u;
  }
  if (!u.email) {
    return NextResponse.json(
      { error: "Account has no email for preferences" },
      { status: 400 }
    );
  }
  const participateMlFeedback = await getParticipateMlFeedback(u.email);
  return NextResponse.json({ data: { participateMlFeedback } });
}

export async function PATCH(request: Request) {
  const u = await requireApiAccountUser();
  if (u instanceof Response) {
    return u;
  }
  if (!u.email) {
    return NextResponse.json(
      { error: "Account has no email for preferences" },
      { status: 400 }
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("participateMlFeedback" in body)) {
    return NextResponse.json(
      { error: "Expected { participateMlFeedback: boolean }" },
      { status: 400 }
    );
  }
  const v = (body as { participateMlFeedback: unknown }).participateMlFeedback;
  if (typeof v !== "boolean") {
    return NextResponse.json(
      { error: "participateMlFeedback must be a boolean" },
      { status: 400 }
    );
  }
  try {
    await setParticipateMlFeedback(u.email, v);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save preferences";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ data: { participateMlFeedback: v } });
}
