import { NextResponse } from "next/server";

import { createManualPlant } from "@/lib/services/plant-manual-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      cultivar?: string;
      trayId?: string;
    };
    const plant = await createManualPlant({
      name: body.name ?? "",
      cultivar: body.cultivar ?? "",
      trayId: body.trayId
    });
    return NextResponse.json({ data: plant });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create plant";
    const status =
      msg.includes("required") || msg.includes("not found") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
