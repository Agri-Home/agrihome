import { NextResponse } from "next/server";

import {
  buildSystemHealth,
  getHealthHttpStatus,
  parseHealthCheckMode
} from "@/lib/health/system-health";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const check = parseHealthCheckMode(new URL(request.url).searchParams);
  const health = await buildSystemHealth(check);

  return NextResponse.json(
    {
      data: health,
      generatedAt: new Date().toISOString()
    },
    { status: getHealthHttpStatus(check, health.ready) }
  );
}
