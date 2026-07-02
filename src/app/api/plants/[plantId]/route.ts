import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import {
  optInt,
  optNullableString,
  optPlantStatus,
  optTrimmedString
} from "@/lib/api/json-fields";
import { requireApiAccountUser } from "@/lib/auth/session";
import {
  deletePlantById,
  updatePlantById
} from "@/lib/services/plant-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ plantId: string }> }
) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { plantId } = await context.params;
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
  const cultivar = typeof o.cultivar === "string" ? o.cultivar : undefined;
  const description =
    o.description === null
      ? null
      : typeof o.description === "string"
        ? o.description
        : undefined;
  const plantIdentifier = optNullableString(o.plantIdentifier);
  const slotLabel = optTrimmedString(o.slotLabel);
  const row = optInt(o.row);
  const column = optInt(o.column);
  const healthScore = optInt(o.healthScore);
  const status = optPlantStatus(o.status);
  const latestDiagnosis = optTrimmedString(o.latestDiagnosis);

  const hasAny =
    name !== undefined ||
    cultivar !== undefined ||
    description !== undefined ||
    plantIdentifier !== undefined ||
    slotLabel !== undefined ||
    row !== undefined ||
    column !== undefined ||
    healthScore !== undefined ||
    status !== undefined ||
    latestDiagnosis !== undefined;

  if (!hasAny) {
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Provide at least one field to update (name, cultivar, description, plantIdentifier, slotLabel, row, column, healthScore, status, latestDiagnosis)",
      400
    );
  }

  try {
    const plant = await updatePlantById(authResult.email, plantId, {
      ...(name !== undefined ? { name } : {}),
      ...(cultivar !== undefined ? { cultivar } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(plantIdentifier !== undefined ? { plantIdentifier } : {}),
      ...(slotLabel !== undefined ? { slotLabel } : {}),
      ...(row !== undefined ? { row } : {}),
      ...(column !== undefined ? { column } : {}),
      ...(healthScore !== undefined ? { healthScore } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(latestDiagnosis !== undefined ? { latestDiagnosis } : {})
    });
    if (!plant) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Plant not found", 404);
    }
    return NextResponse.json({ data: plant });
  } catch (e) {
    return mapErrorToApiResponse(e, "Update failed");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ plantId: string }> }
) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { plantId } = await context.params;
  try {
    const ok = await deletePlantById(authResult.email, plantId);
    if (!ok) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Plant not found", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapErrorToApiResponse(e, "Delete failed");
  }
}
