import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import { createTraySystem, listTraySystems } from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const data = await listTraySystems(authResult.email);

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}

export async function POST(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name : "";
  const zone = typeof o.zone === "string" ? o.zone : "";
  const crop = typeof o.crop === "string" ? o.crop : "";
  const deviceId =
    o.deviceId === undefined || o.deviceId === null
      ? undefined
      : typeof o.deviceId === "string"
        ? o.deviceId
        : undefined;

  try {
    const tray = await createTraySystem({
      ownerEmail: authResult.email,
      name,
      zone,
      crop,
      deviceId
    });
    return NextResponse.json({ data: tray });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create tray";
    const status = msg.includes("required") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
