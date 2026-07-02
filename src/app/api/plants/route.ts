import { NextResponse } from "next/server";

import { apiErrorResponse, API_ERROR_CODES, mapErrorToApiResponse } from "@/lib/api/api-error";
import { requireApiAccountUser } from "@/lib/auth/session";
import { listPlantsByTray } from "@/lib/services/plant-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const trayId = searchParams.get("trayId") ?? undefined;
    const data = await listPlantsByTray(authResult.email, trayId);

    return NextResponse.json({
      data,
      count: data.length,
      refreshedAt: new Date().toISOString()
    });
  } catch (e) {
    return mapErrorToApiResponse(e, "Failed to list plants");
  }
}
