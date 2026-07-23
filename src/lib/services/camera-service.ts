import { queryRows, requirePostgresPool } from "@/lib/db/postgres";
import type { CameraCapture } from "@/lib/types/domain";

interface CameraCaptureRow {
  id: string;
  tray_id: string;
  tray_name: string;
  device_id: string;
  image_url: string | null;
  captured_at: Date | string;
  source: "hardware" | "simulator";
  status: CameraCapture["status"];
  notes: string | null;
  plant_id?: string | null;
  hinge_deg?: string | number | null;
  motor_mm?: string | number | null;
  pose_order?: number | null;
  command_id?: string | null;
}

const mapCaptureRow = (row: CameraCaptureRow): CameraCapture => ({
  id: row.id,
  trayId: row.tray_id,
  trayName: row.tray_name,
  deviceId: row.device_id,
  imageUrl: row.image_url,
  capturedAt: new Date(row.captured_at).toISOString(),
  source: row.source,
  status: row.status,
  notes: row.notes ?? undefined,
  plantId: row.plant_id ?? null,
  hingeDeg: row.hinge_deg != null ? Number(row.hinge_deg) : null,
  motorMm: row.motor_mm != null ? Number(row.motor_mm) : null,
  poseOrder: row.pose_order ?? null,
  commandId: row.command_id ?? null
});

export const getCameraDataSource = async () => "postgres" as const;

export const getLatestCameraCapture = async (
  ownerEmail: string,
  trayId?: string
): Promise<CameraCapture | null> => {
  const values: string[] = [ownerEmail];
  const clauses = [`t.owner_email = $1`];

  if (trayId) {
    values.push(trayId);
    clauses.push(`c.tray_id = $${values.length}`);
  }

  const rows = await queryRows<CameraCaptureRow>(
    `SELECT c.id AS id, c.tray_id AS tray_id, c.tray_name AS tray_name,
            c.device_id AS device_id, c.image_url AS image_url,
            c.captured_at AS captured_at, c.source AS source,
            c.status AS status, c.notes AS notes,
            c.plant_id AS plant_id, c.hinge_deg AS hinge_deg,
            c.motor_mm AS motor_mm, c.pose_order AS pose_order,
            c.command_id AS command_id
     FROM camera_captures c
     INNER JOIN tray_systems t ON t.id = c.tray_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY c.captured_at DESC
     LIMIT 1`,
    values
  );

  return rows[0] ? mapCaptureRow(rows[0]) : null;
};

export const ingestCameraCapture = async (
  payload: Partial<CameraCapture> & {
    deviceId: string;
    trayId: string;
    trayName?: string;
  }
) => {
  const capture: CameraCapture = {
    id: payload.id ?? `capture-${Date.now()}`,
    trayId: payload.trayId,
    trayName: payload.trayName ?? payload.trayId,
    deviceId: payload.deviceId,
    imageUrl: payload.imageUrl ?? null,
    capturedAt: payload.capturedAt ?? new Date().toISOString(),
    source: payload.source ?? "hardware",
    status: payload.imageUrl ? "available" : "missing",
    notes: payload.notes,
    plantId: payload.plantId ?? null,
    hingeDeg: payload.hingeDeg ?? null,
    motorMm: payload.motorMm ?? null,
    poseOrder: payload.poseOrder ?? null,
    commandId: payload.commandId ?? null
  };

  const pool = requirePostgresPool();
  await pool.query(
    `INSERT INTO camera_captures
      (id, tray_id, tray_name, device_id, image_url, captured_at, source, status, notes,
       plant_id, hinge_deg, motor_mm, pose_order, command_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      capture.id,
      capture.trayId,
      capture.trayName,
      capture.deviceId,
      capture.imageUrl,
      capture.capturedAt,
      capture.source,
      capture.status,
      capture.notes ?? null,
      capture.plantId ?? null,
      capture.hingeDeg ?? null,
      capture.motorMm ?? null,
      capture.poseOrder ?? null,
      capture.commandId ?? null
    ]
  );

  return capture;
};
