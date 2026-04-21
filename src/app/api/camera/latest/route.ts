import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import {
  getCameraDataSource,
  getLatestCameraCapture
} from "@/lib/services/camera-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const trayId = searchParams.get("trayId") ?? undefined;
  const [data, source] = await Promise.all([
    getLatestCameraCapture(authResult.email, trayId),
    getCameraDataSource()
  ]);

  return NextResponse.json({
    data,
    source,
    refreshedAt: new Date().toISOString()
  });
}
