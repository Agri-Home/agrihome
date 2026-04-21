import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
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
    return NextResponse.json(
      {
        error:
          "Provide at least one field to update (name, cultivar, description, plantIdentifier, slotLabel, row, column, healthScore, status, latestDiagnosis)"
      },
      { status: 400 }
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
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    return NextResponse.json({ data: plant });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
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
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
