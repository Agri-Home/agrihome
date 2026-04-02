export type DataSource = "mock" | "mariadb";

export type CaptureStatus = "available" | "processing" | "missing";

export type Severity = "low" | "medium" | "high";

export type MonitoringLevel = "info" | "warning" | "critical";
export type TrayHealthStatus = "healthy" | "watch" | "alert";
export type MeshStatus = "draft" | "active";

export interface TraySystem {
  id: string;
  name: string;
  zone: string;
  crop: string;
  plantCount: number;
  healthScore: number;
  status: TrayHealthStatus;
  deviceId: string;
  lastCaptureAt: string;
}

export interface MeshNetwork {
  id: string;
  name: string;
  trayIds: string[];
  nodeCount: number;
  status: MeshStatus;
  createdAt: string;
  summary: string;
}

export interface CameraCapture {
  id: string;
  trayId: string;
  trayName: string;
  deviceId: string;
  imageUrl: string | null;
  capturedAt: string;
  source: "hardware" | "simulator";
  status: CaptureStatus;
  notes?: string;
}

export interface SimilarImageMatch {
  id: string;
  label: string;
  score: number;
  imageUrl: string | null;
}

export interface PredictionResult {
  id: string;
  captureId: string;
  trayId: string;
  label: string;
  confidence: number;
  severity: Severity;
  recommendation: string;
  vectorSource: "mock" | "qdrant";
  createdAt: string;
  similarMatches: SimilarImageMatch[];
}

export interface MonitoringEvent {
  id: string;
  captureId?: string;
  trayId?: string;
  level: MonitoringLevel;
  title: string;
  message: string;
  createdAt: string;
}

export interface SystemHealth {
  api: "healthy" | "degraded";
  database: "connected" | "mock";
  vectorStore: "connected" | "mock";
  cameraPipeline: "online" | "simulated";
}

export interface DashboardSnapshot {
  latestImage: CameraCapture | null;
  latestPrediction: PredictionResult | null;
  monitoringLog: MonitoringEvent[];
}
