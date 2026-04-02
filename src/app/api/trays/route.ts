import { NextResponse } from "next/server";

import { listTraySystems } from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = await listTraySystems();

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}
