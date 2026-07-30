import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import {
  getUserPreferences,
  setUserPreferences
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
  const data = await getUserPreferences(u.email);
  return NextResponse.json({ data });
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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = body as {
    participateMlFeedback?: unknown;
    developerMode?: unknown;
  };
  const patch: {
    participateMlFeedback?: boolean;
    developerMode?: boolean;
  } = {};
  if ("participateMlFeedback" in raw) {
    if (typeof raw.participateMlFeedback !== "boolean") {
      return NextResponse.json(
        { error: "participateMlFeedback must be a boolean" },
        { status: 400 }
      );
    }
    patch.participateMlFeedback = raw.participateMlFeedback;
  }
  if ("developerMode" in raw) {
    if (typeof raw.developerMode !== "boolean") {
      return NextResponse.json(
        { error: "developerMode must be a boolean" },
        { status: 400 }
      );
    }
    patch.developerMode = raw.developerMode;
  }
  if (
    patch.participateMlFeedback === undefined &&
    patch.developerMode === undefined
  ) {
    return NextResponse.json(
      {
        error:
          "Expected { participateMlFeedback?: boolean, developerMode?: boolean }"
      },
      { status: 400 }
    );
  }
  try {
    const data = await setUserPreferences(u.email, patch);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save preferences";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
