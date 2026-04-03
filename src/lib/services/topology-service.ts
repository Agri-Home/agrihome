import { env } from "@/lib/config/env";
import { getPostgresPool, queryRows } from "@/lib/db/postgres";
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
  tray_ids: string[] | string;
  node_count: number;
  status: MeshNetwork["status"];
  created_at: Date | string;
  summary: string;
}

const parseStringArray = (value: string[] | string) =>
  Array.isArray(value) ? value : JSON.parse(value);

export const listTraySystems = async (): Promise<TraySystem[]> => {
  const pool = getPostgresPool();

  if (!env.useMockData && pool) {
    try {
      const rows = await queryRows<TrayRow>(
        `SELECT id, name, zone, crop, plant_count, health_score, status,
                device_id, last_capture_at
         FROM tray_systems
         ORDER BY name ASC`
      );

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
  const pool = getPostgresPool();

  if (!env.useMockData && pool) {
    try {
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
  const pool = getPostgresPool();

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
    } catch {
      return createMockMesh(name, trayIds);
    }
  }

  return createMockMesh(name, trayIds);
};
