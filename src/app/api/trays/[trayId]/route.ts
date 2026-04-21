import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import { updateTraySystem } from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ trayId: string }> }
) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { trayId } = await context.params;
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
  const name = typeof o.name === "string" ? o.name : undefined;
  const zone = typeof o.zone === "string" ? o.zone : undefined;
  const crop = typeof o.crop === "string" ? o.crop : undefined;
  const deviceId =
    o.deviceId === undefined
      ? undefined
      : o.deviceId === null
        ? "manual"
        : typeof o.deviceId === "string"
          ? o.deviceId
          : undefined;

  if (
    name === undefined &&
    zone === undefined &&
    crop === undefined &&
    deviceId === undefined
  ) {
    return NextResponse.json(
      { error: "Provide at least one of: name, zone, crop, deviceId" },
      { status: 400 }
    );
  }

  try {
    const tray = await updateTraySystem({
      ownerEmail: authResult.email,
      id: trayId,
      name,
      zone,
      crop,
      deviceId
    });
    if (!tray) {
      return NextResponse.json({ error: "Tray not found" }, { status: 404 });
    }
    return NextResponse.json({ data: tray });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
