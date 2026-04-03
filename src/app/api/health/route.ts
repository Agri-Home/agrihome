import { NextResponse } from "next/server";

import { isPostgresHealthy } from "@/lib/db/postgres";
import { getVectorSource } from "@/lib/services/vector-service";

export const runtime = "nodejs";

export async function GET() {
  const databaseHealthy = await isPostgresHealthy();

  return NextResponse.json({
    data: {
      api: "healthy",
      database: databaseHealthy ? "connected" : "mock",
      vectorStore: getVectorSource() === "qdrant" ? "connected" : "mock",
      cameraPipeline: "simulated"
    },
    generatedAt: new Date().toISOString()
  });
}
