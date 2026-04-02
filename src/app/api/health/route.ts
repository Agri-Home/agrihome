import { NextResponse } from "next/server";

import { getMariaDbPool } from "@/lib/db/mariadb";
import { getVectorSource } from "@/lib/services/vector-service";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    data: {
      api: "healthy",
      database: getMariaDbPool() ? "connected" : "mock",
      vectorStore: getVectorSource() === "qdrant" ? "connected" : "mock",
      cameraPipeline: "simulated"
    },
    generatedAt: new Date().toISOString()
  });
}
