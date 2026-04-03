export type DataSource = "mock" | "postgres";

export type CaptureStatus = "available" | "processing" | "missing";

export type Severity = "low" | "medium" | "high";

export type MonitoringLevel = "info" | "warning" | "critical";
export type TrayHealthStatus = "healthy" | "watch" | "alert";
export type MeshStatus = "draft" | "active";
export type PlantHealthStatus = "healthy" | "watch" | "alert";
export type ScheduleScopeType = "tray" | "mesh";
export type ReportStatus = "ready" | "pending_review";

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

export interface PlantUnit {
  id: string;
  trayId: string;
  meshIds: string[];
  name: string;
  cultivar: string;
  slotLabel: string;
  row: number;
  column: number;
  healthScore: number;
  status: PlantHealthStatus;
  lastReportAt: string;
  latestDiagnosis: string;
}

export interface CaptureSchedule {
  id: string;
  scopeType: ScheduleScopeType;
  scopeId: string;
  name: string;
  intervalMinutes: number;
  active: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  destination: "computer-vision-backend";
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

export interface PlantReport {
  id: string;
  trayId: string;
  plantId: string;
  captureId?: string;
  diagnosis: string;
  confidence: number;
  severity: Severity;
  diseases: string[];
  deficiencies: string[];
  anomalies: string[];
  summary: string;
  recommendedAction: string;
  status: ReportStatus;
  createdAt: string;
}

export interface MonitoringEvent {
  id: string;
  captureId?: string;
  trayId?: string;
  plantId?: string;
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
