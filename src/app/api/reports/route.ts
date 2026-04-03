import { NextResponse } from "next/server";

import { listPlantReports } from "@/lib/services/plant-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trayId = searchParams.get("trayId") ?? undefined;
  const plantId = searchParams.get("plantId") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 12);
  const data = await listPlantReports({
    trayId,
    plantId,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 12
  });

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}
