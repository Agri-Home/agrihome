import { NextResponse } from "next/server";

import {
  getLatestPrediction,
  getPredictionDataSource
} from "@/lib/services/prediction-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const trayId = searchParams.get("trayId") ?? undefined;
  const [data, source] = await Promise.all([
    getLatestPrediction(trayId),
    getPredictionDataSource()
  ]);

  return NextResponse.json({
    data,
    source,
    refreshedAt: new Date().toISOString()
  });
}
