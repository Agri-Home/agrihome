import { env } from "@/lib/config/env";
import { getPostgresPool, queryRows } from "@/lib/db/postgres";
import { getMockStore } from "@/lib/services/mock-store";
import type { MonitoringEvent } from "@/lib/types/domain";

interface MonitoringRow {
  id: string;
  capture_id: string | null;
  tray_id: string | null;
  level: MonitoringEvent["level"];
  title: string;
  message: string;
  created_at: Date | string;
}

export const getMonitoringLog = async (
  limit = 10,
  trayId?: string
): Promise<MonitoringEvent[]> => {
  const pool = getPostgresPool();

  if (!env.useMockData && pool) {
    try {
      const params: Array<string | number> = [];
      const whereClause = trayId
        ? (() => {
            params.push(trayId);
            return `WHERE tray_id = $${params.length}`;
          })()
        : "";
      params.push(limit);
      const rows = await queryRows<MonitoringRow>(
        `SELECT id, capture_id, tray_id, level, title, message, created_at
         FROM monitoring_events
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
        params
      );

      return rows.map((row) => ({
        id: row.id,
        captureId: row.capture_id ?? undefined,
        trayId: row.tray_id ?? undefined,
        level: row.level,
        title: row.title,
        message: row.message,
        createdAt: new Date(row.created_at).toISOString()
      }));
    } catch {
      return getMockStore().events
        .filter((event) => (trayId ? event.trayId === trayId : true))
        .slice(0, limit);
    }
  }

  return getMockStore().events
    .filter((event) => (trayId ? event.trayId === trayId : true))
    .slice(0, limit);
};
