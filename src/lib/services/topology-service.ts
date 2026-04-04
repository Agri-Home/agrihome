import { queryRows, requirePostgresPool } from "@/lib/db/postgres";
import type { MeshNetwork, TrayPlantDetectionBox, TraySystem } from "@/lib/types/domain";

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

export const listTraySystems = async (): Promise<TraySystem[]> => {
  const rows = await queryRows<TrayRow>(
    `SELECT id, name, zone, crop, plant_count,
            vision_plant_count, vision_plant_count_at, vision_plant_count_confidence,
            vision_detections_json,
            health_score, status, device_id, last_capture_at
     FROM tray_systems
     ORDER BY name ASC`
  );

  return rows.map((row) => ({
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
  }));
};

export const getTrayById = async (id: string): Promise<TraySystem | null> => {
  const trays = await listTraySystems();
  return trays.find((tray) => tray.id === id) ?? null;
};

export const listMeshNetworks = async (): Promise<MeshNetwork[]> => {
  const rows = await queryRows<MeshRow>(
    `SELECT id, name, tray_ids, node_count, status, created_at, summary
     FROM mesh_networks
     ORDER BY created_at DESC`
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    trayIds: parseStringArray(row.tray_ids),
    nodeCount: Number(row.node_count),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    summary: row.summary
  }));
};

export const getMeshById = async (id: string): Promise<MeshNetwork | null> => {
  const meshes = await listMeshNetworks();
  return meshes.find((mesh) => mesh.id === id) ?? null;
};

export const createMeshNetwork = async ({
  name,
  trayIds
}: {
  name: string;
  trayIds: string[];
}): Promise<MeshNetwork> => {
  const pool = requirePostgresPool();
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
      (id, name, tray_ids, node_count, status, created_at, summary)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      mesh.id,
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
