import { env } from "@/lib/config/env";
import { getMariaDbPool } from "@/lib/db/mariadb";
import { createMockMesh, getMockStore } from "@/lib/services/mock-store";
import type { MeshNetwork, TraySystem } from "@/lib/types/domain";

interface TrayRow {
  id: string;
  name: string;
  zone: string;
  crop: string;
  plant_count: number;
  health_score: number;
  status: TraySystem["status"];
  device_id: string;
  last_capture_at: Date | string;
}

interface MeshRow {
  id: string;
  name: string;
  tray_ids: string;
  node_count: number;
  status: MeshNetwork["status"];
  created_at: Date | string;
  summary: string;
}

export const listTraySystems = async (): Promise<TraySystem[]> => {
  const pool = getMariaDbPool();

  if (!env.useMockData && pool) {
    try {
      const rows = (await pool.query(
        `SELECT id, name, zone, crop, plant_count, health_score, status,
                device_id, last_capture_at
         FROM tray_systems
         ORDER BY name ASC`
      )) as TrayRow[];

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        zone: row.zone,
        crop: row.crop,
        plantCount: Number(row.plant_count),
        healthScore: Number(row.health_score),
        status: row.status,
        deviceId: row.device_id,
        lastCaptureAt: new Date(row.last_capture_at).toISOString()
      }));
    } catch {
      return getMockStore().trays;
    }
  }

  return getMockStore().trays;
};

export const listMeshNetworks = async (): Promise<MeshNetwork[]> => {
  const pool = getMariaDbPool();

  if (!env.useMockData && pool) {
    try {
      const rows = (await pool.query(
        `SELECT id, name, tray_ids, node_count, status, created_at, summary
         FROM mesh_networks
         ORDER BY created_at DESC`
      )) as MeshRow[];

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        trayIds: JSON.parse(row.tray_ids),
        nodeCount: Number(row.node_count),
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        summary: row.summary
      }));
    } catch {
      return getMockStore().meshes;
    }
  }

  return getMockStore().meshes;
};

export const createMeshNetwork = async ({
  name,
  trayIds
}: {
  name: string;
  trayIds: string[];
}): Promise<MeshNetwork> => {
  const pool = getMariaDbPool();

  if (!env.useMockData && pool) {
    const mesh: MeshNetwork = {
      id: `mesh-${Date.now()}`,
      name,
      trayIds,
      nodeCount: trayIds.length,
      status: "draft",
      createdAt: new Date().toISOString(),
      summary: `Links ${trayIds.length} tray nodes for shared monitoring, routing, and future hardware coordination.`
    };

    try {
      await pool.query(
        `INSERT INTO mesh_networks
          (id, name, tray_ids, node_count, status, created_at, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
    } catch {
      return createMockMesh(name, trayIds);
    }
  }

  return createMockMesh(name, trayIds);
};
