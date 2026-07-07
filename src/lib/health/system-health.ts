import {
  hasSpeciesInferenceConfig,
  hasTrayVisionInferenceConfig,
  hasVectorConfig
} from "@/lib/config/env";
import { isPostgresHealthy } from "@/lib/db/postgres";
import { getVectorSource } from "@/lib/services/vector-service";

export type HealthCheckMode = "liveness" | "readiness";

export interface CoreHealth {
  api: "healthy";
  database: "connected" | "disconnected";
}

export interface OptionalHealth {
  vectorStore: "connected" | "disconnected" | "unconfigured";
  cameraPipeline: "simulated";
  trayVisionInference: "remote" | "simulated";
  speciesInference: "remote" | "unconfigured";
}

export interface SystemHealthPayload {
  check: HealthCheckMode;
  ready: boolean;
  status: "healthy" | "unhealthy";
  core: CoreHealth;
  optional: OptionalHealth;
}

const buildOptionalHealth = (): OptionalHealth => ({
  vectorStore: hasVectorConfig
    ? getVectorSource() === "qdrant"
      ? "connected"
      : "disconnected"
    : "unconfigured",
  cameraPipeline: "simulated",
  trayVisionInference: hasTrayVisionInferenceConfig ? "remote" : "simulated",
  speciesInference: hasSpeciesInferenceConfig ? "remote" : "unconfigured"
});

export const buildSystemHealth = async (
  check: HealthCheckMode
): Promise<SystemHealthPayload> => {
  const databaseHealthy = await isPostgresHealthy();
  const ready = databaseHealthy;

  const core: CoreHealth = {
    api: "healthy",
    database: databaseHealthy ? "connected" : "disconnected"
  };

  return {
    check,
    ready,
    status:
      check === "readiness" && !ready
        ? "unhealthy"
        : "healthy",
    core,
    optional: buildOptionalHealth()
  };
};

export const getHealthHttpStatus = (
  check: HealthCheckMode,
  ready: boolean
): number => (check === "readiness" && !ready ? 503 : 200);

export const parseHealthCheckMode = (searchParams: URLSearchParams): HealthCheckMode =>
  searchParams.get("ready") === "1" ? "readiness" : "liveness";
