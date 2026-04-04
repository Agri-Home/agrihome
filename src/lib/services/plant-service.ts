import { queryRows } from "@/lib/db/postgres";
import type { PlantReport, PlantUnit } from "@/lib/types/domain";

interface PlantRow {
  id: string;
  tray_id: string;
  mesh_ids: string[] | string;
  name: string;
  cultivar: string;
  slot_label: string;
  row_index: number;
  column_index: number;
  health_score: number;
  status: PlantUnit["status"];
  last_report_at: Date | string;
  latest_diagnosis: string;
  last_image_url?: string | null;
  last_image_at?: Date | string | null;
}

interface PlantReportRow {
  id: string;
  tray_id: string;
  plant_id: string;
  capture_id: string | null;
  diagnosis: string;
  confidence: number;
  severity: PlantReport["severity"];
  diseases: string[] | string;
  deficiencies: string[] | string;
  anomalies: string[] | string;
  summary: string;
  recommended_action: string;
  status: PlantReport["status"];
  created_at: Date | string;
}

const parseStringArray = (value: string[] | string) =>
  Array.isArray(value) ? value : JSON.parse(value);

export const listPlantsByTray = async (
  trayId?: string
): Promise<PlantUnit[]> => {
  const values: string[] = [];
  const whereClause = trayId
    ? (() => {
        values.push(trayId);
        return `WHERE tray_id = $${values.length}`;
      })()
    : "";
  const rows = await queryRows<PlantRow>(
    `SELECT id, tray_id, mesh_ids, name, cultivar, slot_label, row_index,
            column_index, health_score, status, last_report_at, latest_diagnosis,
            last_image_url, last_image_at
     FROM plants
     ${whereClause}
     ORDER BY tray_id ASC, row_index ASC, column_index ASC`,
    values
  );

  return rows.map((row) => ({
    id: row.id,
    trayId: row.tray_id,
    meshIds: parseStringArray(row.mesh_ids),
    name: row.name,
    cultivar: row.cultivar,
    slotLabel: row.slot_label,
    row: Number(row.row_index),
    column: Number(row.column_index),
    healthScore: Number(row.health_score),
    status: row.status,
    lastReportAt: new Date(row.last_report_at).toISOString(),
    latestDiagnosis: row.latest_diagnosis,
    lastImageUrl: row.last_image_url ?? null,
    lastImageAt: row.last_image_at
      ? new Date(row.last_image_at).toISOString()
      : new Date(row.last_report_at).toISOString()
  }));
};

export const getPlantById = async (id: string): Promise<PlantUnit | null> => {
  const plants = await listPlantsByTray();
  return plants.find((plant) => plant.id === id) ?? null;
};

export const listPlantReports = async ({
  trayId,
  plantId,
  limit = 12
}: {
  trayId?: string;
  plantId?: string;
  limit?: number;
} = {}): Promise<PlantReport[]> => {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (trayId) {
    params.push(trayId);
    clauses.push(`tray_id = $${params.length}`);
  }

  if (plantId) {
    params.push(plantId);
    clauses.push(`plant_id = $${params.length}`);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  const rows = await queryRows<PlantReportRow>(
    `SELECT id, tray_id, plant_id, capture_id, diagnosis, confidence, severity,
            diseases, deficiencies, anomalies, summary, recommended_action,
            status, created_at
     FROM plant_reports
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT ${limitParam}`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    trayId: row.tray_id,
    plantId: row.plant_id,
    captureId: row.capture_id ?? undefined,
    diagnosis: row.diagnosis,
    confidence: Number(row.confidence),
    severity: row.severity,
    diseases: parseStringArray(row.diseases),
    deficiencies: parseStringArray(row.deficiencies),
    anomalies: parseStringArray(row.anomalies),
    summary: row.summary,
    recommendedAction: row.recommended_action,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString()
  }));
};
