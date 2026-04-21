import { createSchema } from "graphql-yoga";

import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { listPlantReports, listPlantsByTray } from "@/lib/services/plant-service";
import { getLatestPrediction } from "@/lib/services/prediction-service";
import { listSchedules, upsertSchedule } from "@/lib/services/schedule-service";
import {
  createMeshNetwork,
  createTraySystem,
  listMeshNetworks,
  listTraySystems,
  updateTraySystem
} from "@/lib/services/topology-service";
import {
  deletePlantById,
  updatePlantById
} from "@/lib/services/plant-service";
import {
  hasSpeciesInferenceConfig,
  hasTrayVisionInferenceConfig
} from "@/lib/config/env";
import { getVectorSource } from "@/lib/services/vector-service";
import { isPostgresHealthy } from "@/lib/db/postgres";
import type { PlantHealthStatus } from "@/lib/types/domain";

interface GraphQLContext {
  userEmail: string;
}

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type CameraCapture {
      id: ID!
      trayId: String!
      trayName: String!
      deviceId: String!
      imageUrl: String
      capturedAt: String!
      source: String!
      status: String!
      notes: String
    }

    type SimilarImageMatch {
      id: ID!
      label: String!
      score: Float!
      imageUrl: String
    }

    type PredictionResult {
      id: ID!
      captureId: String!
      trayId: String!
      label: String!
      confidence: Float!
      severity: String!
      recommendation: String!
      vectorSource: String!
      createdAt: String!
      similarMatches: [SimilarImageMatch!]!
    }

    type MonitoringEvent {
      id: ID!
      captureId: String
      trayId: String
      plantId: String
      level: String!
      title: String!
      message: String!
      createdAt: String!
    }

    type TrayPlantBox {
      x: Float!
      y: Float!
      w: Float!
      h: Float!
      score: Float!
      label: String
    }

    type TraySystem {
      id: ID!
      name: String!
      zone: String!
      crop: String!
      plantCount: Int!
      visionPlantCount: Int
      visionPlantCountAt: String
      visionPlantCountConfidence: Float
      visionDetections: [TrayPlantBox!]
      healthScore: Int!
      status: String!
      deviceId: String!
      lastCaptureAt: String!
    }

    type MeshNetwork {
      id: ID!
      name: String!
      trayIds: [String!]!
      nodeCount: Int!
      status: String!
      createdAt: String!
      summary: String!
    }

    type PlantUnit {
      id: ID!
      trayId: String!
      meshIds: [String!]!
      name: String!
      cultivar: String!
      description: String
      plantIdentifier: String
      slotLabel: String!
      row: Int!
      column: Int!
      healthScore: Int!
      status: String!
      lastReportAt: String!
      latestDiagnosis: String!
      lastImageUrl: String
      lastImageAt: String!
    }

    type PlantReport {
      id: ID!
      trayId: String!
      plantId: String!
      captureId: String
      diagnosis: String!
      confidence: Float!
      severity: String!
      diseases: [String!]!
      deficiencies: [String!]!
      anomalies: [String!]!
      summary: String!
      recommendedAction: String!
      status: String!
      createdAt: String!
    }

    type CaptureSchedule {
      id: ID!
      scopeType: String!
      scopeId: String!
      name: String!
      intervalMinutes: Int!
      active: Boolean!
      nextRunAt: String!
      lastRunAt: String
      destination: String!
    }

    type SystemHealth {
      api: String!
      database: String!
      vectorStore: String!
      cameraPipeline: String!
      trayVisionInference: String!
      speciesInference: String!
    }

    type Query {
      latestImage(trayId: String): CameraCapture
      latestPrediction(trayId: String): PredictionResult
      monitoringLog(limit: Int = 10, trayId: String, plantId: String): [MonitoringEvent!]!
      traySystems: [TraySystem!]!
      meshNetworks: [MeshNetwork!]!
      plants(trayId: String): [PlantUnit!]!
      reports(trayId: String, plantId: String, limit: Int = 12): [PlantReport!]!
      schedules(scopeType: String, scopeId: String): [CaptureSchedule!]!
      health: SystemHealth!
    }

    type Mutation {
      createMeshNetwork(name: String!, trayIds: [String!]!): MeshNetwork!
      createTray(name: String!, zone: String!, crop: String!, deviceId: String): TraySystem!
      updateTray(
        trayId: ID!
        name: String
        zone: String
        crop: String
        deviceId: String
      ): TraySystem!
      updatePlant(
        plantId: ID!
        name: String
        cultivar: String
        description: String
        plantIdentifier: String
        slotLabel: String
        row: Int
        column: Int
        healthScore: Int
        status: String
        latestDiagnosis: String
      ): PlantUnit!
      deletePlant(plantId: ID!): Boolean!
      upsertSchedule(
        id: String
        scopeType: String!
        scopeId: String!
        name: String!
        intervalMinutes: Int!
        active: Boolean!
      ): CaptureSchedule!
    }
  `,
  resolvers: {
    Query: {
      latestImage: (
        _parent,
        args: { trayId?: string },
        context: GraphQLContext
      ) => getLatestCameraCapture(context.userEmail, args.trayId),
      latestPrediction: (
        _parent,
        args: { trayId?: string },
        context: GraphQLContext
      ) => getLatestPrediction(context.userEmail, args.trayId),
      monitoringLog: (
        _parent,
        args: { limit?: number; trayId?: string; plantId?: string },
        context: GraphQLContext
      ) =>
        getMonitoringLog({
          ownerEmail: context.userEmail,
          limit: args.limit ?? 10,
          trayId: args.trayId,
          plantId: args.plantId
        }),
      traySystems: (
        _parent,
        _args: unknown,
        context: GraphQLContext
      ) => listTraySystems(context.userEmail),
      meshNetworks: (
        _parent,
        _args: unknown,
        context: GraphQLContext
      ) => listMeshNetworks(context.userEmail),
      plants: (
        _parent,
        args: { trayId?: string },
        context: GraphQLContext
      ) => listPlantsByTray(context.userEmail, args.trayId),
      reports: (
        _parent,
        args: { trayId?: string; plantId?: string; limit?: number },
        context: GraphQLContext
      ) =>
        listPlantReports({
          ownerEmail: context.userEmail,
          trayId: args.trayId,
          plantId: args.plantId,
          limit: args.limit
        }),
      schedules: (
        _parent,
        args: { scopeType?: "tray" | "mesh"; scopeId?: string },
        context: GraphQLContext
      ) =>
        listSchedules({
          ownerEmail: context.userEmail,
          scopeType: args.scopeType,
          scopeId: args.scopeId
        }),
      health: async () => ({
        api: "healthy",
        database: (await isPostgresHealthy()) ? "connected" : "disconnected",
        vectorStore: getVectorSource() === "qdrant" ? "connected" : "disconnected",
        cameraPipeline: "simulated",
        trayVisionInference: hasTrayVisionInferenceConfig ? "remote" : "simulated",
        speciesInference: hasSpeciesInferenceConfig ? "remote" : "unconfigured"
      })
    },
    Mutation: {
      createMeshNetwork: (
        _parent,
        args: { name: string; trayIds: string[] },
        context: GraphQLContext
      ) =>
        createMeshNetwork({
          ownerEmail: context.userEmail,
          name: args.name,
          trayIds: args.trayIds
        }),
      createTray: (
        _parent,
        args: {
          name: string;
          zone: string;
          crop: string;
          deviceId?: string | null;
        },
        context: GraphQLContext
      ) =>
        createTraySystem({
          ownerEmail: context.userEmail,
          name: args.name,
          zone: args.zone,
          crop: args.crop,
          deviceId: args.deviceId ?? undefined
        }),
      updateTray: async (
        _parent,
        args: {
          trayId: string;
          name?: string | null;
          zone?: string | null;
          crop?: string | null;
          deviceId?: string | null;
        },
        context: GraphQLContext
      ) => {
        const tray = await updateTraySystem({
          ownerEmail: context.userEmail,
          id: args.trayId,
          name: args.name ?? undefined,
          zone: args.zone ?? undefined,
          crop: args.crop ?? undefined,
          deviceId: args.deviceId === null ? "manual" : args.deviceId ?? undefined
        });
        if (!tray) {
          throw new Error("Tray not found");
        }
        return tray;
      },
      updatePlant: async (
        _parent,
        args: {
          plantId: string;
          name?: string | null;
          cultivar?: string | null;
          description?: string | null;
          plantIdentifier?: string | null;
          slotLabel?: string | null;
          row?: number | null;
          column?: number | null;
          healthScore?: number | null;
          status?: string | null;
          latestDiagnosis?: string | null;
        },
        context: GraphQLContext
      ) => {
        const plant = await updatePlantById(context.userEmail, args.plantId, {
          ...(args.name != null ? { name: args.name } : {}),
          ...(args.cultivar != null ? { cultivar: args.cultivar } : {}),
          ...(args.description !== undefined
            ? { description: args.description }
            : {}),
          ...(args.plantIdentifier !== undefined
            ? { plantIdentifier: args.plantIdentifier }
            : {}),
          ...(args.slotLabel !== undefined && args.slotLabel !== null
            ? { slotLabel: args.slotLabel }
            : {}),
          ...(args.row !== undefined && args.row !== null
            ? { row: args.row }
            : {}),
          ...(args.column !== undefined && args.column !== null
            ? { column: args.column }
            : {}),
          ...(args.healthScore !== undefined && args.healthScore !== null
            ? { healthScore: args.healthScore }
            : {}),
          ...(args.status !== undefined && args.status !== null
            ? { status: args.status as PlantHealthStatus }
            : {}),
          ...(args.latestDiagnosis !== undefined && args.latestDiagnosis !== null
            ? { latestDiagnosis: args.latestDiagnosis }
            : {})
        });
        if (!plant) {
          throw new Error("Plant not found");
        }
        return plant;
      },
      deletePlant: (
        _parent,
        args: { plantId: string },
        context: GraphQLContext
      ) => deletePlantById(context.userEmail, args.plantId),
      upsertSchedule: (
        _parent,
        args: {
          id?: string;
          scopeType: "tray" | "mesh";
          scopeId: string;
          name: string;
          intervalMinutes: number;
          active: boolean;
        },
        context: GraphQLContext
      ) =>
        upsertSchedule({
          ownerEmail: context.userEmail,
          id: args.id,
          scopeType: args.scopeType,
          scopeId: args.scopeId,
          name: args.name,
          intervalMinutes: args.intervalMinutes,
          active: args.active
        })
    }
  }
});
