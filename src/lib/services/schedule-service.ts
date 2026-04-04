import { queryRows, requirePostgresPool } from "@/lib/db/postgres";
import type { CaptureSchedule } from "@/lib/types/domain";

interface ScheduleRow {
  id: string;
  scope_type: CaptureSchedule["scopeType"];
  scope_id: string;
  name: string;
  interval_minutes: number;
  active: number | boolean;
  next_run_at: Date | string;
  last_run_at: Date | string | null;
  destination: CaptureSchedule["destination"];
}

export const listSchedules = async ({
  scopeType,
  scopeId
}: {
  scopeType?: CaptureSchedule["scopeType"];
  scopeId?: string;
} = {}): Promise<CaptureSchedule[]> => {
  const clauses: string[] = [];
  const params: string[] = [];

  if (scopeType) {
    params.push(scopeType);
    clauses.push(`scope_type = $${params.length}`);
  }

  if (scopeId) {
    params.push(scopeId);
    clauses.push(`scope_id = $${params.length}`);
  }

  const rows = await queryRows<ScheduleRow>(
    `SELECT id, scope_type, scope_id, name, interval_minutes, active,
            next_run_at, last_run_at, destination
     FROM capture_schedules
     ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
     ORDER BY scope_type ASC, name ASC`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    name: row.name,
    intervalMinutes: Number(row.interval_minutes),
    active: Boolean(row.active),
    nextRunAt: new Date(row.next_run_at).toISOString(),
    lastRunAt: row.last_run_at
      ? new Date(row.last_run_at).toISOString()
      : undefined,
    destination: row.destination
  }));
};

export const upsertSchedule = async (payload: {
  id?: string;
  scopeType: CaptureSchedule["scopeType"];
  scopeId: string;
  name: string;
  intervalMinutes: number;
  active: boolean;
}): Promise<CaptureSchedule> => {
  const pool = requirePostgresPool();
  const schedule: CaptureSchedule = {
    id: payload.id ?? `schedule-${Date.now()}`,
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
    name: payload.name,
    intervalMinutes: payload.intervalMinutes,
    active: payload.active,
    nextRunAt: new Date(
      Date.now() + payload.intervalMinutes * 60 * 1000
    ).toISOString(),
    lastRunAt: undefined,
    destination: "computer-vision-backend"
  };

  await pool.query(
    `INSERT INTO capture_schedules
      (id, scope_type, scope_id, name, interval_minutes, active, next_run_at, destination)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       scope_type = EXCLUDED.scope_type,
       scope_id = EXCLUDED.scope_id,
       name = EXCLUDED.name,
       interval_minutes = EXCLUDED.interval_minutes,
       active = EXCLUDED.active,
       next_run_at = EXCLUDED.next_run_at,
       destination = EXCLUDED.destination`,
    [
      schedule.id,
      schedule.scopeType,
      schedule.scopeId,
      schedule.name,
      schedule.intervalMinutes,
      schedule.active,
      schedule.nextRunAt,
      schedule.destination
    ]
  );

  return schedule;
};
