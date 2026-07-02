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
import { createManualPlant } from "@/lib/services/plant-manual-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  try {
    const plant = await createManualPlant({
      ownerEmail: authResult.email,
      name: typeof o.name === "string" ? o.name : "",
      cultivar: typeof o.cultivar === "string" ? o.cultivar : "",
      trayId: optTrimmedString(o.trayId),
      row: optInt(o.row),
      column: optInt(o.column),
      slotLabel: optTrimmedString(o.slotLabel),
      plantIdentifier: optNullableString(o.plantIdentifier),
      description: optNullableString(o.description),
      healthScore: optInt(o.healthScore),
      status: optPlantStatus(o.status),
      latestDiagnosis: optTrimmedString(o.latestDiagnosis)
    });
    return NextResponse.json({ data: plant });
  } catch (e) {
    return mapErrorToApiResponse(e, "Failed to create plant");
  }
}
