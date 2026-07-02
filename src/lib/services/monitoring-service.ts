import { queryRows, requirePostgresPool } from "@/lib/db/postgres";
import type { MonitoringEvent, MonitoringLevel } from "@/lib/types/domain";

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

export const recordMonitoringEvent = async (input: {
  id?: string;
  captureId?: string;
  trayId?: string;
  plantId?: string;
  level: MonitoringLevel;
  title: string;
  message: string;
}): Promise<MonitoringEvent> => {
  const pool = requirePostgresPool();
  const id =
    input.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  await pool.query(
    `INSERT INTO monitoring_events
      (id, capture_id, tray_id, plant_id, level, title, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      input.captureId ?? null,
      input.trayId ?? null,
      input.plantId ?? null,
      input.level,
      input.title.slice(0, 160),
      input.message
    ]
  );

  return {
    id,
    captureId: input.captureId,
    trayId: input.trayId,
    plantId: input.plantId,
    level: input.level,
    title: input.title.slice(0, 160),
    message: input.message,
    createdAt: new Date().toISOString()
  };
};
