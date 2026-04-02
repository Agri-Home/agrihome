import { NextResponse } from "next/server";

import { getMonitoringLog } from "@/lib/services/monitoring-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 10);
  const trayId = searchParams.get("trayId") ?? undefined;
  const data = await getMonitoringLog(
    Number.isFinite(limit) && limit > 0 ? limit : 10,
    trayId
  );

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}
