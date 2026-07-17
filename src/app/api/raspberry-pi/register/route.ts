import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { registerEdgeDevice } from "@/lib/services/edge-device-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/raspberry-pi/register
 * Auto-provision a Moonraker-backed Raspberry Pi.
 * Auth: DEVICE_PROVISIONING_SECRET via body.provisioningCode (not Firebase).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cpuSerial?: string;
      macAddress?: string;
      hostname?: string;
      model?: string;
      moonrakerUrl?: string;
      provisioningCode?: string;
      ownerEmail?: string;
      trayName?: string;
      zone?: string;
      crop?: string;
      reProvision?: boolean;
    };

    if (!body.cpuSerial?.trim() || !body.provisioningCode?.trim()) {
      return apiErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        "cpuSerial and provisioningCode are required",
        400
      );
    }

    const result = await registerEdgeDevice({
      cpuSerial: body.cpuSerial,
      macAddress: body.macAddress,
      hostname: body.hostname,
      model: body.model,
      moonrakerUrl: body.moonrakerUrl,
      provisioningCode: body.provisioningCode,
      ownerEmail: body.ownerEmail,
      trayName: body.trayName,
      zone: body.zone,
      crop: body.crop,
      reProvision: Boolean(body.reProvision)
    });

    return NextResponse.json(
      {
        message: result.reProvisioned
          ? "Device re-provisioned; store the new API key now"
          : "Device registered; store the API key now (shown once)",
        data: {
          deviceId: result.device.id,
          trayId: result.tray.id,
          trayName: result.tray.name,
          apiKey: result.apiKey,
          apiKeyPrefix: result.device.apiKeyPrefix,
          ownerEmail: result.device.ownerEmail,
          reProvisioned: result.reProvisioned
        }
      },
      { status: result.reProvisioned ? 200 : 201 }
    );
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status === 403) {
      return apiErrorResponse(
        API_ERROR_CODES.FORBIDDEN,
        error instanceof Error ? error.message : "Forbidden",
        403
      );
    }
    if (status === 409) {
      return apiErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        error instanceof Error ? error.message : "Conflict",
        409
      );
    }
    return mapErrorToApiResponse(error);
  }
}
