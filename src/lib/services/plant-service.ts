import { queryRows, requirePostgresPool } from "@/lib/db/postgres";
import type { PlantReport, PlantUnit } from "@/lib/types/domain";

const DESCRIPTION_MAX = 4000;

interface PlantRow {
  id: string;
  tray_id: string;
  mesh_ids: string[] | string;
  name: string;
  cultivar: string;
  description?: string | null;
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
    `SELECT id, tray_id, mesh_ids, name, cultivar, description, slot_label, row_index,
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
    description: row.description ?? null,
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
  const rows = await queryRows<PlantRow>(
    `SELECT id, tray_id, mesh_ids, name, cultivar, description, slot_label, row_index,
            column_index, health_score, status, last_report_at, latest_diagnosis,
            last_image_url, last_image_at
     FROM plants WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    trayId: row.tray_id,
    meshIds: parseStringArray(row.mesh_ids),
    name: row.name,
    cultivar: row.cultivar,
    description: row.description ?? null,
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
  };
};

export async function updatePlantById(
  id: string,
  input: {
    name?: string;
    cultivar?: string;
    description?: string | null;
  }
): Promise<PlantUnit | null> {
  const existing = await getPlantById(id);
  if (!existing) {
    return null;
  }

  const name =
    input.name !== undefined ? input.name.trim() : existing.name;
  const cultivar =
    input.cultivar !== undefined ? input.cultivar.trim() : existing.cultivar;
  let description: string | null =
    input.description !== undefined
      ? input.description === null || input.description === ""
        ? null
        : input.description.trim().slice(0, DESCRIPTION_MAX)
      : existing.description;

  if (!name || !cultivar) {
    throw new Error("Name and cultivar cannot be empty");
  }

  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE plants SET name = $1, cultivar = $2, description = $3 WHERE id = $4`,
    [name, cultivar, description, id]
  );

  return getPlantById(id);
}

export async function deletePlantById(id: string): Promise<boolean> {
  const pool = requirePostgresPool();
  const client = await pool.connect();
  try {
    const plantRes = await client.query<{ tray_id: string }>(
      `SELECT tray_id FROM plants WHERE id = $1`,
      [id]
    );
    if (plantRes.rowCount === 0) {
      return false;
    }
    const trayId = plantRes.rows[0].tray_id;

    const capRes = await client.query<{ capture_id: string | null }>(
      `SELECT capture_id FROM plant_reports WHERE plant_id = $1 AND capture_id IS NOT NULL`,
      [id]
    );
    const captureIds = [
      ...new Set(
        capRes.rows
          .map((r) => r.capture_id)
          .filter((c): c is string => Boolean(c))
      )
    ];

    await client.query("BEGIN");
    if (captureIds.length > 0) {
      await client.query(
        `DELETE FROM prediction_results WHERE capture_id = ANY($1::varchar[])`,
        [captureIds]
      );
    }
    await client.query(`DELETE FROM plant_reports WHERE plant_id = $1`, [id]);

    for (const cid of captureIds) {
      const still = await client.query(
        `SELECT 1 FROM plant_reports WHERE capture_id = $1 LIMIT 1`,
        [cid]
      );
      if (still.rowCount === 0) {
        await client.query(`DELETE FROM camera_captures WHERE id = $1`, [cid]);
      }
    }

    await client.query(
      `UPDATE monitoring_events SET plant_id = NULL WHERE plant_id = $1`,
      [id]
    );

    await client.query(`DELETE FROM plants WHERE id = $1`, [id]);
    await client.query(
      `UPDATE tray_systems SET plant_count = (SELECT COUNT(*)::int FROM plants WHERE tray_id = $1) WHERE id = $1`,
      [trayId]
    );
    await client.query("COMMIT");
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

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
