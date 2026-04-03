import { env } from "@/lib/config/env";
import { getPostgresPool, queryRows } from "@/lib/db/postgres";
import { getMockStore } from "@/lib/services/mock-store";
import type { MonitoringEvent } from "@/lib/types/domain";

interface MonitoringRow {
  id: string;
  capture_id: string | null;
  tray_id: string | null;
  plant_id: string | null;
  level: MonitoringEvent["level"];
  title: string;
  message: string;
  created_at: Date | string;
}

export const getMonitoringLog = async (
  limit = 10,
  trayId?: string,
  plantId?: string
): Promise<MonitoringEvent[]> => {
  const pool = getPostgresPool();

  if (!env.useMockData && pool) {
    try {
      const params: Array<string | number> = [];
      const clauses: string[] = [];

      if (trayId) {
        params.push(trayId);
        clauses.push(`tray_id = $${params.length}`);
      }

      if (plantId) {
        params.push(plantId);
        clauses.push(`plant_id = $${params.length}`);
      }

      params.push(limit);
      const limitIdx = params.length;

      const rows = await queryRows<MonitoringRow>(
        `SELECT id, capture_id, tray_id, plant_id, level, title, message, created_at
         FROM monitoring_events
         ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
         ORDER BY created_at DESC
         LIMIT $${limitIdx}`,
        params
      );

      return rows.map((row) => ({
        id: row.id,
        captureId: row.capture_id ?? undefined,
        trayId: row.tray_id ?? undefined,
        plantId: row.plant_id ?? undefined,
        level: row.level,
        title: row.title,
        message: row.message,
        createdAt: new Date(row.created_at).toISOString()
      }));
    } catch {
      return filterMockEvents(limit, trayId, plantId);
    }
  }

  return filterMockEvents(limit, trayId, plantId);
};

function filterMockEvents(limit: number, trayId?: string, plantId?: string) {
  return getMockStore()
    .events.filter((event) => (trayId ? event.trayId === trayId : true))
    .filter((event) => (plantId ? event.plantId === plantId : true))
    .slice(0, limit);
}
