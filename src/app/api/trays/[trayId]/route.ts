import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
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
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Provide at least one of: name, zone, crop, deviceId",
      400
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
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Tray not found", 404);
    }
    return NextResponse.json({ data: tray });
  } catch (e) {
    return mapErrorToApiResponse(e, "Update failed");
  }
}
