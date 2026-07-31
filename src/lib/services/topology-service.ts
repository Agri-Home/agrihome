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
  edge_device_id: string | null;
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
  edgeDeviceId: row.edge_device_id ?? null,
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
            health_score, status, device_id, edge_device_id, last_capture_at
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
            health_score, status, device_id, edge_device_id, last_capture_at
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

/**
 * Permanently delete a tray and all associated plants, poses, schedules,
 * captures, and reports. Mesh networks lose this tray id from their lists.
 * The linked edge device (if any) is left registered but unlinked.
 */
export const deleteTraySystem = async (
  ownerEmail: string,
  id: string
): Promise<boolean> => {
  const existing = await getTrayById(ownerEmail, id);
  if (!existing) {
    return false;
  }

  if (existing.edgeDeviceId) {
    throw new Error(
      "Unregister the linked Raspberry Pi before deleting this tray."
    );
  }

  const pool = requirePostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const plantRes = await client.query<{ id: string }>(
      `SELECT id FROM plants WHERE tray_id = $1 AND owner_email = $2`,
      [id, ownerEmail]
    );
    const plantIds = plantRes.rows.map((r) => r.id);

    const capFromReports = await client.query<{ capture_id: string | null }>(
      `SELECT capture_id FROM plant_reports
       WHERE tray_id = $1 AND capture_id IS NOT NULL`,
      [id]
    );
    const capFromTray = await client.query<{ id: string }>(
      `SELECT id FROM camera_captures WHERE tray_id = $1`,
      [id]
    );
    const captureIds = [
      ...new Set([
        ...capFromReports.rows
          .map((r) => r.capture_id)
          .filter((c): c is string => Boolean(c)),
        ...capFromTray.rows.map((r) => r.id)
      ])
    ];

    if (captureIds.length > 0) {
      await client.query(
        `DELETE FROM prediction_results WHERE capture_id = ANY($1::varchar[])`,
        [captureIds]
      );
    }
    await client.query(`DELETE FROM prediction_results WHERE tray_id = $1`, [
      id
    ]);

    await client.query(`DELETE FROM plant_reports WHERE tray_id = $1`, [id]);

    if (captureIds.length > 0) {
      await client.query(
        `DELETE FROM camera_captures WHERE id = ANY($1::varchar[])`,
        [captureIds]
      );
    }

    await client.query(
      `UPDATE monitoring_events
       SET plant_id = NULL, tray_id = NULL, capture_id = NULL
       WHERE tray_id = $1 OR plant_id = ANY($2::varchar[])`,
      [id, plantIds.length > 0 ? plantIds : ["__none__"]]
    );

    if (plantIds.length > 0) {
      await client.query(
        `DELETE FROM capture_poses WHERE plant_id = ANY($1::varchar[])`,
        [plantIds]
      );
    }

    const seqRes = await client.query<{ id: string }>(
      `SELECT id FROM capture_pose_sequences
       WHERE tray_id = $1 AND owner_email = $2`,
      [id, ownerEmail]
    );
    const sequenceIds = seqRes.rows.map((r) => r.id);
    if (sequenceIds.length > 0) {
      await client.query(
        `DELETE FROM capture_poses WHERE sequence_id = ANY($1::varchar[])`,
        [sequenceIds]
      );
      await client.query(
        `DELETE FROM capture_pose_sequences WHERE id = ANY($1::varchar[])`,
        [sequenceIds]
      );
    }

    await client.query(
      `UPDATE edge_device_commands
       SET tray_id = NULL, plant_id = NULL
       WHERE tray_id = $1 OR plant_id = ANY($2::varchar[])`,
      [id, plantIds.length > 0 ? plantIds : ["__none__"]]
    );

    await client.query(
      `DELETE FROM plants WHERE tray_id = $1 AND owner_email = $2`,
      [id, ownerEmail]
    );

    await client.query(
      `DELETE FROM capture_schedules
       WHERE owner_email = $1 AND scope_type = 'tray' AND scope_id = $2`,
      [ownerEmail, id]
    );

    const meshes = await client.query<{
      id: string;
      tray_ids: string[] | string;
    }>(
      `SELECT id, tray_ids FROM mesh_networks WHERE owner_email = $1`,
      [ownerEmail]
    );
    for (const mesh of meshes.rows) {
      const raw = mesh.tray_ids;
      const ids: string[] = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(raw) as unknown;
                return Array.isArray(parsed)
                  ? parsed.filter((x): x is string => typeof x === "string")
                  : [];
              } catch {
                return [];
              }
            })()
          : [];
      if (!ids.includes(id)) continue;
      const next = ids.filter((t) => t !== id);
      await client.query(
        `UPDATE mesh_networks
         SET tray_ids = $1::json, node_count = $2,
             summary = $3
         WHERE id = $4 AND owner_email = $5`,
        [
          JSON.stringify(next),
          next.length,
          `${next.length} trays in this group.`,
          mesh.id,
          ownerEmail
        ]
      );
    }

    const del = await client.query(
      `DELETE FROM tray_systems WHERE id = $1 AND owner_email = $2`,
      [id, ownerEmail]
    );

    await client.query("COMMIT");
    return (del.rowCount ?? 0) > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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
