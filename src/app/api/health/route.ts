import { NextResponse } from "next/server";

import {
  hasSpeciesInferenceConfig,
  hasTrayVisionInferenceConfig
} from "@/lib/config/env";
import { isPostgresHealthy } from "@/lib/db/postgres";
import { getVectorSource } from "@/lib/services/vector-service";

export const runtime = "nodejs";

export async function GET() {
  const databaseHealthy = await isPostgresHealthy();

  return NextResponse.json({
    data: {
      api: "healthy",
      database: databaseHealthy ? "connected" : "disconnected",
      vectorStore: getVectorSource() === "qdrant" ? "connected" : "disconnected",
      cameraPipeline: "simulated",
      trayVisionInference: hasTrayVisionInferenceConfig ? "remote" : "simulated",
      speciesInference: hasSpeciesInferenceConfig ? "remote" : "unconfigured"
    },
    generatedAt: new Date().toISOString()
  });
}
