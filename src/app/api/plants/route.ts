import { NextResponse } from "next/server";

import { mapErrorToApiResponse } from "@/lib/api/api-error";
import { requireApiAccountUser } from "@/lib/auth/session";
import { listPlantsPage } from "@/lib/services/plant-service";

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
    const limit = Number(searchParams.get("limit") ?? undefined);
    const page = await listPlantsPage({
      ownerEmail: authResult.email,
      trayId,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: Number.isFinite(limit) ? limit : undefined
    });

    return NextResponse.json({
      data: page.data,
      count: page.data.length,
      nextCursor: page.nextCursor,
      refreshedAt: new Date().toISOString()
    });
  } catch (e) {
    return mapErrorToApiResponse(e, "Failed to list plants");
  }
}
