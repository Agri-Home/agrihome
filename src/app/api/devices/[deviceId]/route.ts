import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireApiAccountUser } from "@/lib/auth/session";
import { updateDeviceActuatorLimits } from "@/lib/services/capture-pose-service";
import {
  getEdgeDeviceById,
  linkDeviceToTray,
  revokeEdgeDevice,
  rotateEdgeDeviceKey
} from "@/lib/services/edge-device-service";
import { enqueueEdgeCommand } from "@/lib/services/edge-command-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ deviceId: string }> };

/** GET /api/devices/[deviceId] */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireApiAccountUser();
  if (auth instanceof Response) return auth;
  const { deviceId } = await context.params;

  try {
    const device = await getEdgeDeviceById(deviceId);
    if (!device || device.ownerEmail !== auth.email.toLowerCase()) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Device not found", 404);
    }
    return NextResponse.json({ data: device });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}

/**
 * POST /api/devices/[deviceId]
 * Actions: capture | linkTray | revoke | rotateKey | updateLimits
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireApiAccountUser();
  if (auth instanceof Response) return auth;
  const { deviceId } = await context.params;

  try {
    const device = await getEdgeDeviceById(deviceId);
    if (!device || device.ownerEmail !== auth.email.toLowerCase()) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Device not found", 404);
    }

    const body = (await request.json()) as {
      action?: string;
      trayId?: string;
      plantId?: string;
      runPoses?: boolean;
      actuatorLimits?: {
        hingeMinDeg?: number;
        hingeMaxDeg?: number;
        motorMinMm?: number;
        motorMaxMm?: number;
      };
    };

    if (body.action === "capture") {
      if (device.revokedAt) {
        return apiErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          "Device is revoked",
          403
        );
      }
      let trayId = body.trayId;
      if (!trayId) {
        const { requirePostgresPool } = await import("@/lib/db/postgres");
        const pool = requirePostgresPool();
        const linked = await pool.query<{ id: string }>(
          `SELECT id FROM tray_systems
           WHERE edge_device_id = $1 AND owner_email = $2
           LIMIT 1`,
          [deviceId, auth.email.toLowerCase()]
        );
        trayId = linked.rows[0]?.id;
      }
      if (!trayId) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "No tray linked to this device",
          400
        );
      }
      const cmd = await enqueueEdgeCommand({
        deviceId,
        trayId,
        plantId: body.plantId,
        commandType: "capture_now",
        payload: {
          runPoses: Boolean(body.runPoses),
          requestedBy: auth.email
        }
      });
      return NextResponse.json({
        message:
          "Capture command queued. The Pi agent will claim it on the next heartbeat.",
        data: cmd
      });
    }

    if (body.action === "linkTray") {
      if (!body.trayId) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "trayId is required",
          400
        );
      }
      const tray = await linkDeviceToTray({
        ownerEmail: auth.email,
        deviceId,
        trayId: body.trayId
      });
      if (!tray) {
        return apiErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          "Tray or device not found",
          404
        );
      }
      return NextResponse.json({ data: tray, message: "Device linked to tray" });
    }

    if (body.action === "revoke") {
      const revoked = await revokeEdgeDevice(auth.email, deviceId);
      return NextResponse.json({ data: revoked, message: "Device revoked" });
    }

    if (body.action === "rotateKey") {
      const rotated = await rotateEdgeDeviceKey(auth.email, deviceId);
      if (!rotated) {
        return apiErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          "Device not found",
          404
        );
      }
      return NextResponse.json({
        message: "New API key issued — copy it now; it will not be shown again",
        data: {
          device: rotated.device,
          apiKey: rotated.apiKey
        }
      });
    }

    if (body.action === "updateLimits" && body.actuatorLimits) {
      const ok = await updateDeviceActuatorLimits({
        ownerEmail: auth.email,
        deviceId,
        ...body.actuatorLimits
      });
      if (!ok) {
        return apiErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          "Device not found",
          404
        );
      }
      const updated = await getEdgeDeviceById(deviceId);
      return NextResponse.json({ data: updated });
    }

    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Unknown action. Use capture, linkTray, revoke, rotateKey, or updateLimits.",
      400
    );
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
