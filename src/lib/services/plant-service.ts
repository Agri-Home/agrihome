import { queryRows, requirePostgresPool } from "@/lib/db/postgres";
import { syncTrayStatsFromPlants } from "@/lib/services/topology-service";
import type { PlantReport, PlantUnit } from "@/lib/types/domain";

const DESCRIPTION_MAX = 4000;

interface PlantRow {
  id: string;
  tray_id: string;
  mesh_ids: string[] | string;
  name: string;
  cultivar: string;
  description?: string | null;
  plant_identifier?: string | null;
  slot_label: string;
  row_index: number;
  column_index: number;
  health_score: number;
  status: PlantUnit["status"];
  last_report_at: Date | string;
  latest_diagnosis: string;
  last_image_url?: string | null;
  last_image_at?: Date | string | null;
  created_at?: Date | string;
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

interface PlantDashboardSummaryRow {
  plant_count: number | string;
  average_health_score: number | string;
  alert_count: number | string;
  watch_count: number | string;
}

interface PageCursor {
  createdAt: string;
  id: string;
}

export interface PaginatedResult<TItem> {
  data: TItem[];
  nextCursor: string | null;
}

const DEFAULT_PLANT_PAGE_LIMIT = 50;
const DEFAULT_REPORT_PAGE_LIMIT = 12;
const MAX_PAGE_LIMIT = 100;
const parseStringArray = (value: string[] | string) =>
  Array.isArray(value) ? value : JSON.parse(value);

const normalizePageLimit = (limit: number | undefined, fallback: number) => {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(limit), MAX_PAGE_LIMIT);
};

const encodeCursor = (cursor: PageCursor) =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

const decodeCursor = (cursor: string | undefined): PageCursor | null => {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed.createdAt !== "string" ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      throw new Error("Invalid cursor payload");
    }
    return parsed;
  } catch {
    throw new Error("Invalid pagination cursor");
  }
};

const mapPlantRow = (row: PlantRow): PlantUnit => ({
  id: row.id,
  trayId: row.tray_id,
  meshIds: parseStringArray(row.mesh_ids),
  name: row.name,
  cultivar: row.cultivar,
  description: row.description ?? null,
  plantIdentifier: row.plant_identifier ?? null,
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
});

export const listPlantsByTray = async (
  ownerEmail: string,
  trayId?: string
): Promise<PlantUnit[]> => {
  const values: string[] = [ownerEmail];
  const clauses = [`owner_email = $1`];

  if (trayId) {
    values.push(trayId);
    clauses.push(`tray_id = $${values.length}`);
  }

  const rows = await queryRows<PlantRow>(
    `SELECT id, tray_id, mesh_ids, name, cultivar, description, plant_identifier, slot_label, row_index,
            column_index, health_score, status, last_report_at, latest_diagnosis,
            last_image_url, last_image_at
     FROM plants
     WHERE ${clauses.join(" AND ")}
     ORDER BY tray_id ASC, row_index ASC, column_index ASC`,
    values
  );

  return rows.map(mapPlantRow);
};

export const listPlantsPage = async ({
  ownerEmail,
  trayId,
  cursor,
  limit
}: {
  ownerEmail: string;
  trayId?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<PlantUnit>> => {
  const decodedCursor = decodeCursor(cursor);
  const pageLimit = normalizePageLimit(limit, DEFAULT_PLANT_PAGE_LIMIT);
  const values: Array<string | number> = [ownerEmail];
  const clauses = [`owner_email = $1`];

  if (trayId) {
    values.push(trayId);
    clauses.push(`tray_id = $${values.length}`);
  }

  if (decodedCursor) {
    values.push(decodedCursor.createdAt, decodedCursor.id);
    const createdAtParam = `$${values.length - 1}`;
    const idParam = `$${values.length}`;
    clauses.push(
      `(created_at < ${createdAtParam} OR (created_at = ${createdAtParam} AND id < ${idParam}))`
    );
  }

  values.push(pageLimit + 1);
  const limitParam = `$${values.length}`;

  const rows = await queryRows<PlantRow>(
    `SELECT id, tray_id, mesh_ids, name, cultivar, description, plant_identifier, slot_label, row_index,
            column_index, health_score, status, last_report_at, latest_diagnosis,
            last_image_url, last_image_at, created_at
     FROM plants
     WHERE ${clauses.join(" AND ")}
     ORDER BY created_at DESC, id DESC
     LIMIT ${limitParam}`,
    values
  );

  const hasNextPage = rows.length > pageLimit;
  const visibleRows = rows.slice(0, pageLimit);
  const lastRow = visibleRows[visibleRows.length - 1];

  return {
    data: visibleRows.map(mapPlantRow),
    nextCursor:
      hasNextPage && lastRow?.created_at
        ? encodeCursor({
            createdAt: new Date(lastRow.created_at).toISOString(),
            id: lastRow.id
          })
        : null
  };
};

export const getPlantDashboardSummary = async (
  ownerEmail: string
): Promise<{
  plantCount: number;
  averageHealthScore: number;
  alertCount: number;
  watchCount: number;
}> => {
  const rows = await queryRows<PlantDashboardSummaryRow>(
    `SELECT COUNT(*)::int AS plant_count,
            COALESCE(ROUND(AVG(health_score)), 0)::int AS average_health_score,
            COUNT(*) FILTER (WHERE status = 'alert')::int AS alert_count,
            COUNT(*) FILTER (WHERE status = 'watch')::int AS watch_count
     FROM plants
     WHERE owner_email = $1`,
    [ownerEmail]
  );
  const row = rows[0];

  return {
    plantCount: Number(row?.plant_count ?? 0),
    averageHealthScore: Number(row?.average_health_score ?? 0),
    alertCount: Number(row?.alert_count ?? 0),
    watchCount: Number(row?.watch_count ?? 0)
  };
};

export const getPlantById = async (
  ownerEmail: string,
  id: string
): Promise<PlantUnit | null> => {
  const rows = await queryRows<PlantRow>(
    `SELECT id, tray_id, mesh_ids, name, cultivar, description, plant_identifier, slot_label, row_index,
            column_index, health_score, status, last_report_at, latest_diagnosis,
            last_image_url, last_image_at
     FROM plants
     WHERE owner_email = $1 AND id = $2`,
    [ownerEmail, id]
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return mapPlantRow(row);
};

const HEALTH_STATUSES: PlantUnit["status"][] = ["healthy", "watch", "alert"];

function clampHealth(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function updatePlantById(
  ownerEmail: string,
  id: string,
  input: {
    name?: string;
    cultivar?: string;
    description?: string | null;
    plantIdentifier?: string | null;
    slotLabel?: string;
    row?: number;
    column?: number;
    healthScore?: number;
    status?: PlantUnit["status"];
    latestDiagnosis?: string;
  }
): Promise<PlantUnit | null> {
  const existing = await getPlantById(ownerEmail, id);
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

  let plantIdentifier: string | null =
    input.plantIdentifier !== undefined
      ? input.plantIdentifier === null || input.plantIdentifier === ""
        ? null
        : input.plantIdentifier.trim().slice(0, 120)
      : existing.plantIdentifier;

  const slotLabel =
    input.slotLabel !== undefined ? input.slotLabel.trim() : existing.slotLabel;
  const row =
    input.row !== undefined ? Math.max(1, Math.floor(input.row)) : existing.row;
  const column =
    input.column !== undefined
      ? Math.max(1, Math.floor(input.column))
      : existing.column;
  const healthScore =
    input.healthScore !== undefined
      ? clampHealth(input.healthScore)
      : existing.healthScore;
  const status =
    input.status !== undefined ? input.status : existing.status;
  if (!HEALTH_STATUSES.includes(status)) {
    throw new Error("Invalid health status");
  }
  const latestDiagnosis =
    input.latestDiagnosis !== undefined
      ? input.latestDiagnosis.trim().slice(0, 160)
      : existing.latestDiagnosis;

  if (!name || !cultivar) {
    throw new Error("Name and cultivar cannot be empty");
  }
  if (!slotLabel) {
    throw new Error("Slot label cannot be empty");
  }

  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE plants
     SET name = $1, cultivar = $2, description = $3, plant_identifier = $4,
         slot_label = $5, row_index = $6, column_index = $7,
         health_score = $8, status = $9, latest_diagnosis = $10
     WHERE id = $11 AND owner_email = $12`,
    [
      name,
      cultivar,
      description,
      plantIdentifier,
      slotLabel,
      row,
      column,
      healthScore,
      status,
      latestDiagnosis,
      id,
      ownerEmail
    ]
  );

  await syncTrayStatsFromPlants(ownerEmail, existing.trayId);

  return getPlantById(ownerEmail, id);
}

export async function deletePlantById(
  ownerEmail: string,
  id: string
): Promise<boolean> {
  const pool = requirePostgresPool();
  const client = await pool.connect();
  try {
    const plantRes = await client.query<{ tray_id: string }>(
      `SELECT tray_id
       FROM plants
       WHERE id = $1 AND owner_email = $2`,
      [id, ownerEmail]
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

    await client.query(`DELETE FROM plants WHERE id = $1 AND owner_email = $2`, [
      id,
      ownerEmail
    ]);
    await client.query("COMMIT");
    await syncTrayStatsFromPlants(ownerEmail, trayId);
    return true;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export const listPlantReportsPage = async ({
  ownerEmail,
  trayId,
  plantId,
  cursor,
  limit
}: {
  ownerEmail: string;
  trayId?: string;
  plantId?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<PlantReport>> => {
  const decodedCursor = decodeCursor(cursor);
  const pageLimit = normalizePageLimit(limit, DEFAULT_REPORT_PAGE_LIMIT);
  const clauses: string[] = [`p.owner_email = $1`];
  const params: Array<string | number> = [ownerEmail];

  if (trayId) {
    params.push(trayId);
    clauses.push(`pr.tray_id = $${params.length}`);
  }

  if (plantId) {
    params.push(plantId);
    clauses.push(`pr.plant_id = $${params.length}`);
  }

  if (decodedCursor) {
    params.push(decodedCursor.createdAt, decodedCursor.id);
    const createdAtParam = `$${params.length - 1}`;
    const idParam = `$${params.length}`;
    clauses.push(
      `(pr.created_at < ${createdAtParam} OR (pr.created_at = ${createdAtParam} AND pr.id < ${idParam}))`
    );
  }

  params.push(pageLimit + 1);
  const limitParam = `$${params.length}`;

  const rows = await queryRows<PlantReportRow>(
    `SELECT pr.id AS id, pr.tray_id AS tray_id, pr.plant_id AS plant_id,
            pr.capture_id AS capture_id, pr.diagnosis AS diagnosis,
            pr.confidence AS confidence, pr.severity AS severity,
            pr.diseases AS diseases, pr.deficiencies AS deficiencies,
            pr.anomalies AS anomalies, pr.summary AS summary,
            pr.recommended_action AS recommended_action,
            pr.status AS status, pr.created_at AS created_at
     FROM plant_reports pr
     INNER JOIN plants p ON p.id = pr.plant_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY pr.created_at DESC, pr.id DESC
     LIMIT ${limitParam}`,
    params
  );

  const hasNextPage = rows.length > pageLimit;
  const visibleRows = rows.slice(0, pageLimit);
  const lastRow = visibleRows[visibleRows.length - 1];

  return {
    data: visibleRows.map((row) => ({
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
    })),
    nextCursor:
      hasNextPage && lastRow
        ? encodeCursor({
            createdAt: new Date(lastRow.created_at).toISOString(),
            id: lastRow.id
          })
        : null
  };
};

export const listPlantReports = async (input: {
  ownerEmail: string;
  trayId?: string;
  plantId?: string;
  limit?: number;
}): Promise<PlantReport[]> => {
  const page = await listPlantReportsPage(input);

  return page.data;
};
