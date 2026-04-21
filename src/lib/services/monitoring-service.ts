import { queryRows } from "@/lib/db/postgres";
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

export const getMonitoringLog = async ({
  ownerEmail,
  limit = 10,
  trayId,
  plantId
}: {
  ownerEmail: string;
  limit?: number;
  trayId?: string;
  plantId?: string;
}): Promise<MonitoringEvent[]> => {
  const params: Array<string | number> = [ownerEmail];
  const clauses: string[] = [
    `(
      (me.tray_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM tray_systems t
        WHERE t.id = me.tray_id AND t.owner_email = $1
      ))
      OR
      (me.plant_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM plants p
        WHERE p.id = me.plant_id AND p.owner_email = $1
      ))
    )`
  ];

  if (trayId) {
    params.push(trayId);
    clauses.push(`me.tray_id = $${params.length}`);
  }

  if (plantId) {
    params.push(plantId);
    clauses.push(`me.plant_id = $${params.length}`);
  }

  params.push(limit);
  const limitIdx = params.length;

  const rows = await queryRows<MonitoringRow>(
    `SELECT id, capture_id, tray_id, plant_id, level, title, message, created_at
     FROM monitoring_events me
     WHERE ${clauses.join(" AND ")}
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
};
