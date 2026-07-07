import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireApiAccountUser } from "@/lib/auth/session";
import { createTraySystem, listTraySystems } from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const data = await listTraySystems(authResult.email);

    return NextResponse.json({
      data,
      count: data.length,
      refreshedAt: new Date().toISOString()
    });
  } catch (e) {
    return mapErrorToApiResponse(e, "Failed to list trays");
  }
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
    return apiErrorResponse(API_ERROR_CODES.BAD_REQUEST, "Invalid JSON", 400);
  }
  if (!body || typeof body !== "object") {
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Expected JSON object",
      400
    );
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
    return mapErrorToApiResponse(e, "Failed to create tray");
  }
}
