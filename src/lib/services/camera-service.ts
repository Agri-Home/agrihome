import { env } from "@/lib/config/env";
import { getPostgresPool, queryRows } from "@/lib/db/postgres";
import { getMockStore, ingestMockCapture } from "@/lib/services/mock-store";
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
  notes: row.notes ?? undefined
});

export const getCameraDataSource = async () => {
  const pool = getPostgresPool();

  return !env.useMockData && pool ? "postgres" : "mock";
};

export const getLatestCameraCapture = async (
  trayId?: string
): Promise<CameraCapture | null> => {
  const pool = getPostgresPool();

  if (!env.useMockData && pool) {
    try {
      const values: string[] = [];
      const whereClause = trayId
        ? (() => {
            values.push(trayId);
            return `WHERE tray_id = $${values.length}`;
          })()
        : "";
      const rows = await queryRows<CameraCaptureRow>(
        `SELECT id, tray_id, tray_name, device_id, image_url, captured_at, source, status, notes
         FROM camera_captures
         ${whereClause}
         ORDER BY captured_at DESC
         LIMIT 1`,
        values
      );

      return rows[0] ? mapCaptureRow(rows[0]) : null;
    } catch {
      return (
        getMockStore().captures.find((capture) =>
          trayId ? capture.trayId === trayId : true
        ) ?? null
      );
    }
  }

  return (
    getMockStore().captures.find((capture) =>
      trayId ? capture.trayId === trayId : true
    ) ?? null
  );
};

export const ingestCameraCapture = async (
  payload: Partial<CameraCapture> & { deviceId: string; trayId: string; trayName?: string }
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
    notes: payload.notes
  };

  const pool = getPostgresPool();

  if (!env.useMockData && pool) {
    try {
      await pool.query(
        `INSERT INTO camera_captures
          (id, tray_id, tray_name, device_id, image_url, captured_at, source, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          capture.id,
          capture.trayId,
          capture.trayName,
          capture.deviceId,
          capture.imageUrl,
          capture.capturedAt,
          capture.source,
          capture.status,
          capture.notes ?? null
        ]
      );

      return capture;
    } catch {
      return ingestMockCapture(capture).capture;
    }
  }

  return ingestMockCapture(capture).capture;
};
