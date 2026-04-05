import { NextResponse } from "next/server";

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

  if (name === undefined && cultivar === undefined && description === undefined) {
    return NextResponse.json(
      { error: "Provide at least one of: name, cultivar, description" },
      { status: 400 }
    );
  }

  try {
    const plant = await updatePlantById(plantId, {
      ...(name !== undefined ? { name } : {}),
      ...(cultivar !== undefined ? { cultivar } : {}),
      ...(description !== undefined ? { description } : {})
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
  const { plantId } = await context.params;
  try {
    const ok = await deletePlantById(plantId);
    if (!ok) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
