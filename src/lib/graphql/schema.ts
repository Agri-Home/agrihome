import { createSchema } from "graphql-yoga";

import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { getLatestPrediction } from "@/lib/services/prediction-service";
import {
  createMeshNetwork,
  listMeshNetworks,
  listTraySystems
} from "@/lib/services/topology-service";
import { getVectorSource } from "@/lib/services/vector-service";
import { getMariaDbPool } from "@/lib/db/mariadb";

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
      level: String!
      title: String!
      message: String!
      createdAt: String!
    }

    type TraySystem {
      id: ID!
      name: String!
      zone: String!
      crop: String!
      plantCount: Int!
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

    type SystemHealth {
      api: String!
      database: String!
      vectorStore: String!
      cameraPipeline: String!
    }

    type Query {
      latestImage(trayId: String): CameraCapture
      latestPrediction(trayId: String): PredictionResult
      monitoringLog(limit: Int = 10, trayId: String): [MonitoringEvent!]!
      traySystems: [TraySystem!]!
      meshNetworks: [MeshNetwork!]!
      health: SystemHealth!
    }

    type Mutation {
      createMeshNetwork(name: String!, trayIds: [String!]!): MeshNetwork!
    }
  `,
  resolvers: {
    Query: {
      latestImage: (_parent, args: { trayId?: string }) =>
        getLatestCameraCapture(args.trayId),
      latestPrediction: (_parent, args: { trayId?: string }) =>
        getLatestPrediction(args.trayId),
      monitoringLog: (_parent, args: { limit?: number; trayId?: string }) =>
        getMonitoringLog(args.limit ?? 10, args.trayId),
      traySystems: () => listTraySystems(),
      meshNetworks: () => listMeshNetworks(),
      health: () => ({
        api: "healthy",
        database: getMariaDbPool() ? "connected" : "mock",
        vectorStore: getVectorSource() === "qdrant" ? "connected" : "mock",
        cameraPipeline: "simulated"
      })
    },
    Mutation: {
      createMeshNetwork: (
        _parent,
        args: { name: string; trayIds: string[] }
      ) => createMeshNetwork(args)
    }
  }
});
