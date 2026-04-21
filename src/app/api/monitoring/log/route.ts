import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import { getMonitoringLog } from "@/lib/services/monitoring-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 10);
  const trayId = searchParams.get("trayId") ?? undefined;
  const plantId = searchParams.get("plantId") ?? undefined;
  const data = await getMonitoringLog({
    ownerEmail: authResult.email,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    trayId,
    plantId
  });

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}
