import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireDeviceApiKey } from "@/lib/auth/device-auth";
import { getActivePoseSequenceForDevice } from "@/lib/services/capture-pose-service";
import { getEdgeDeviceById } from "@/lib/services/edge-device-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/raspberry-pi/poses
 * Device-authenticated active pose sequence + actuator safe limits.
 */
export async function GET(request: Request) {
  const auth = await requireDeviceApiKey(request);
  if (auth instanceof Response) return auth;

  try {
    const [sequence, device] = await Promise.all([
      getActivePoseSequenceForDevice(auth.id),
      getEdgeDeviceById(auth.id)
    ]);

    if (!device) {
      return apiErrorResponse(
        API_ERROR_CODES.NOT_FOUND,
        "Device not found",
        404
      );
    }

    return NextResponse.json({
      data: {
        sequence,
        actuatorLimits: {
          hingeMinDeg: device.hingeMinDeg,
          hingeMaxDeg: device.hingeMaxDeg,
          motorMinMm: device.motorMinMm,
          motorMaxMm: device.motorMaxMm
        }
      }
    });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
