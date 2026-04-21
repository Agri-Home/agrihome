import { queryRows, requirePostgresPool } from "@/lib/db/postgres";
import type {
  MeshNetwork,
  TrayHealthStatus,
  TrayPlantDetectionBox,
  TraySystem
} from "@/lib/types/domain";

interface TrayRow {
  id: string;
  name: string;
  zone: string;
  crop: string;
  plant_count: number;
  vision_plant_count: number | null;
  vision_plant_count_at: Date | string | null;
  vision_plant_count_confidence: string | number | null;
  vision_detections_json: TrayPlantDetectionBox[] | string | null;
  health_score: number;
  status: TraySystem["status"];
  device_id: string;
  last_capture_at: Date | string;
}

const parseTrayDetections = (
  raw: TrayRow["vision_detections_json"]
): TrayPlantDetectionBox[] | null => {
  if (raw == null) {
    return null;
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? (v as TrayPlantDetectionBox[]) : null;
    } catch {
      return null;
    }
  }
  return null;
};

interface MeshRow {
  id: string;
  name: string;
  tray_ids: string[] | string;
  node_count: number;
  status: MeshNetwork["status"];
  created_at: Date | string;
  summary: string;
}

const parseStringArray = (value: string[] | string) =>
  Array.isArray(value) ? value : JSON.parse(value);

const mapTrayRow = (row: TrayRow): TraySystem => ({
  id: row.id,
  name: row.name,
  zone: row.zone,
  crop: row.crop,
  plantCount: Number(row.plant_count),
  visionPlantCount:
    row.vision_plant_count != null ? Number(row.vision_plant_count) : null,
  visionPlantCountAt: row.vision_plant_count_at
    ? new Date(row.vision_plant_count_at).toISOString()
    : null,
  visionPlantCountConfidence:
    row.vision_plant_count_confidence != null
      ? Number(row.vision_plant_count_confidence)
      : null,
  visionDetections: parseTrayDetections(row.vision_detections_json),
  healthScore: Number(row.health_score),
  status: row.status,
  deviceId: row.device_id,
  lastCaptureAt: new Date(row.last_capture_at).toISOString()
});

const mapMeshRow = (row: MeshRow): MeshNetwork => ({
  id: row.id,
  name: row.name,
  trayIds: parseStringArray(row.tray_ids),
  nodeCount: Number(row.node_count),
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  summary: row.summary
});

export const listTraySystems = async (ownerEmail: string): Promise<TraySystem[]> => {
  const rows = await queryRows<TrayRow>(
    `SELECT id, name, zone, crop, plant_count,
            vision_plant_count, vision_plant_count_at, vision_plant_count_confidence,
            vision_detections_json,
            health_score, status, device_id, last_capture_at
     FROM tray_systems
     WHERE owner_email = $1
     ORDER BY name ASC`,
    [ownerEmail]
  );

  return rows.map(mapTrayRow);
};

export const getTrayById = async (
  ownerEmail: string,
  id: string
): Promise<TraySystem | null> => {
  const rows = await queryRows<TrayRow>(
    `SELECT id, name, zone, crop, plant_count,
            vision_plant_count, vision_plant_count_at, vision_plant_count_confidence,
            vision_detections_json,
            health_score, status, device_id, last_capture_at
     FROM tray_systems
     WHERE owner_email = $1 AND id = $2
     LIMIT 1`,
    [ownerEmail, id]
  );

  return rows[0] ? mapTrayRow(rows[0]) : null;
};

export const listMeshNetworks = async (
  ownerEmail: string
): Promise<MeshNetwork[]> => {
  const rows = await queryRows<MeshRow>(
    `SELECT id, name, tray_ids, node_count, status, created_at, summary
     FROM mesh_networks
     WHERE owner_email = $1
     ORDER BY created_at DESC`,
    [ownerEmail]
  );

  return rows.map(mapMeshRow);
};

export const getMeshById = async (
  ownerEmail: string,
  id: string
): Promise<MeshNetwork | null> => {
  const rows = await queryRows<MeshRow>(
    `SELECT id, name, tray_ids, node_count, status, created_at, summary
     FROM mesh_networks
     WHERE owner_email = $1 AND id = $2
     LIMIT 1`,
    [ownerEmail, id]
  );

  return rows[0] ? mapMeshRow(rows[0]) : null;
};

export async function syncTrayStatsFromPlants(
  ownerEmail: string,
  trayId: string
): Promise<void> {
  const pool = requirePostgresPool();
  const agg = await pool.query<{
    c: string;
    avg_h: string | null;
    any_alert: boolean | null;
    any_watch: boolean | null;
  }>(
    `SELECT COUNT(*)::int AS c,
            AVG(health_score) AS avg_h,
            BOOL_OR(status = 'alert') AS any_alert,
            BOOL_OR(status = 'watch') AS any_watch
     FROM plants
     WHERE tray_id = $1 AND owner_email = $2`,
    [trayId, ownerEmail]
  );
  const row = agg.rows[0];
  const cnt = Number(row?.c ?? 0);
  let status: TrayHealthStatus = "healthy";
  if (cnt > 0) {
    if (row?.any_alert) {
      status = "alert";
    } else if (row?.any_watch) {
      status = "watch";
    }
  }
  const healthScore =
    cnt === 0 ? 100 : Math.max(0, Math.min(100, Math.round(Number(row?.avg_h ?? 0))));

  await pool.query(
    `UPDATE tray_systems
     SET plant_count = $1, health_score = $2, status = $3
     WHERE id = $4 AND owner_email = $5`,
    [cnt, healthScore, status, trayId, ownerEmail]
  );
}

export const createTraySystem = async ({
  ownerEmail,
  name,
  zone,
  crop,
  deviceId
}: {
  ownerEmail: string;
  name: string;
  zone: string;
  crop: string;
  deviceId?: string;
}): Promise<TraySystem> => {
  const pool = requirePostgresPool();
  const id = `tray-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const trimmedName = name.trim();
  const trimmedZone = zone.trim();
  const trimmedCrop = crop.trim();
  if (!trimmedName || !trimmedZone || !trimmedCrop) {
    throw new Error("Name, zone, and crop are required");
  }
  const dev = (deviceId ?? "manual").trim() || "manual";
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO tray_systems
      (id, owner_email, name, zone, crop, plant_count, health_score, status, device_id, last_capture_at)
     VALUES ($1, $2, $3, $4, $5, 0, 100, 'healthy', $6, $7)`,
    [id, ownerEmail, trimmedName, trimmedZone, trimmedCrop, dev, now]
  );

  const created = await getTrayById(ownerEmail, id);
  if (!created) {
    throw new Error("Tray was not created");
  }
  return created;
};

export const updateTraySystem = async ({
  ownerEmail,
  id,
  name,
  zone,
  crop,
  deviceId
}: {
  ownerEmail: string;
  id: string;
  name?: string;
  zone?: string;
  crop?: string;
  deviceId?: string;
}): Promise<TraySystem | null> => {
  const existing = await getTrayById(ownerEmail, id);
  if (!existing) {
    return null;
  }
  const pool = requirePostgresPool();
  const nextName = name !== undefined ? name.trim() : existing.name;
  const nextZone = zone !== undefined ? zone.trim() : existing.zone;
  const nextCrop = crop !== undefined ? crop.trim() : existing.crop;
  const nextDevice = deviceId !== undefined ? deviceId.trim() : existing.deviceId;
  if (!nextName || !nextZone || !nextCrop) {
    throw new Error("Name, zone, and crop cannot be empty");
  }

  await pool.query(
    `UPDATE tray_systems
     SET name = $1, zone = $2, crop = $3, device_id = $4
     WHERE id = $5 AND owner_email = $6`,
    [nextName, nextZone, nextCrop, nextDevice, id, ownerEmail]
  );

  return getTrayById(ownerEmail, id);
};

export const createMeshNetwork = async ({
  ownerEmail,
  name,
  trayIds
}: {
  ownerEmail: string;
  name: string;
  trayIds: string[];
}): Promise<MeshNetwork> => {
  const pool = requirePostgresPool();
  const ownedTrayRows = await pool.query<{ id: string }>(
    `SELECT id
     FROM tray_systems
     WHERE owner_email = $1 AND id = ANY($2::varchar[])`,
    [ownerEmail, trayIds]
  );

  if (ownedTrayRows.rowCount !== trayIds.length) {
    throw new Error("One or more trays were not found");
  }

  const mesh: MeshNetwork = {
    id: `mesh-${Date.now()}`,
    name,
    trayIds,
    nodeCount: trayIds.length,
    status: "draft",
    createdAt: new Date().toISOString(),
    summary: `${trayIds.length} trays in this group.`
  };

  await pool.query(
    `INSERT INTO mesh_networks
      (id, owner_email, name, tray_ids, node_count, status, created_at, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      mesh.id,
      ownerEmail,
      mesh.name,
      JSON.stringify(mesh.trayIds),
      mesh.nodeCount,
      mesh.status,
      mesh.createdAt,
      mesh.summary
    ]
  );

  return mesh;
};
