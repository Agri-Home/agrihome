import { NextResponse } from "next/server";

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
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
    const msg = e instanceof Error ? e.message : "Failed to create plant";
    const status =
      msg.includes("required") ||
      msg.includes("not found") ||
      msg.includes("Invalid") ||
      msg.includes("Provide both")
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
