import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireApiAccountUser } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import {
  listEdgeDevicesForOwner,
  markStaleDevicesOffline
} from "@/lib/services/edge-device-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/devices — list edge devices for the signed-in operator. */
export async function GET() {
  const auth = await requireApiAccountUser();
  if (auth instanceof Response) return auth;

  try {
    await markStaleDevicesOffline(env.device.heartbeatStaleMinutes);
    const devices = await listEdgeDevicesForOwner(auth.email);
    return NextResponse.json({
      data: devices.map((d) => ({
        id: d.id,
        cpuSerial: d.cpuSerial,
        macAddress: d.macAddress,
        hostname: d.hostname,
        model: d.model,
        moonrakerUrl: d.moonrakerUrl,
        status: d.status,
        lastHeartbeatAt: d.lastHeartbeatAt,
        apiKeyPrefix: d.apiKeyPrefix,
        revokedAt: d.revokedAt,
        actuatorLimits: {
          hingeMinDeg: d.hingeMinDeg,
          hingeMaxDeg: d.hingeMaxDeg,
          motorMinMm: d.motorMinMm,
          motorMaxMm: d.motorMaxMm
        }
      })),
      meta: {
        heartbeatStaleMinutes: env.device.heartbeatStaleMinutes
      }
    });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
