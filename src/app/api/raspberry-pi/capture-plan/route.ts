import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireDeviceApiKey } from "@/lib/auth/device-auth";
import { getActivePoseSequenceForDevice } from "@/lib/services/capture-pose-service";
import { getEdgeDeviceById } from "@/lib/services/edge-device-service";
import { queryRows } from "@/lib/db/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/raspberry-pi/capture-plan
 * Schedule timing + active poses + actuator limits for the Pi executor loop.
 */
export async function GET(request: Request) {
  const auth = await requireDeviceApiKey(request);
  if (auth instanceof Response) return auth;

  try {
    const device = await getEdgeDeviceById(auth.id);
    if (!device) {
      return apiErrorResponse(
        API_ERROR_CODES.NOT_FOUND,
        "Device not found",
        404
      );
    }

    const trays = await queryRows<{ id: string; name: string }>(
      `SELECT id, name FROM tray_systems
       WHERE edge_device_id = $1 AND owner_email = $2`,
      [auth.id, auth.ownerEmail]
    );

    const trayIds = trays.map((t) => t.id);
    const schedules =
      trayIds.length === 0
        ? []
        : await queryRows<{
            id: string;
            name: string;
            interval_minutes: number;
            next_run_at: Date | string;
            last_run_at: Date | string | null;
            active: boolean;
            scope_id: string;
          }>(
            `SELECT id, name, interval_minutes, next_run_at, last_run_at, active, scope_id
             FROM capture_schedules
             WHERE owner_email = $1
               AND active = TRUE
               AND destination = 'raspberry-pi-edge'
               AND (
                 (scope_type = 'tray' AND scope_id = ANY($2::text[]))
                 OR scope_type = 'mesh'
               )
             ORDER BY next_run_at ASC
             LIMIT 20`,
            [auth.ownerEmail, trayIds]
          );

    const sequence = await getActivePoseSequenceForDevice(auth.id);

    return NextResponse.json({
      data: {
        deviceId: auth.id,
        trays,
        schedules: schedules.map((s) => ({
          id: s.id,
          name: s.name,
          intervalMinutes: Number(s.interval_minutes),
          nextRunAt: new Date(s.next_run_at).toISOString(),
          lastRunAt: s.last_run_at
            ? new Date(s.last_run_at).toISOString()
            : null,
          active: Boolean(s.active),
          scopeId: s.scope_id
        })),
        poseSequence: sequence,
        actuatorLimits: {
          hingeMinDeg: device.hingeMinDeg,
          hingeMaxDeg: device.hingeMaxDeg,
          motorMinMm: device.motorMinMm,
          motorMaxMm: device.motorMaxMm
        },
        serverTime: new Date().toISOString()
      }
    });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
