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
  rotateEdgeDeviceKey,
  updateEdgeDeviceMoonrakerUrl
} from "@/lib/services/edge-device-service";
import { captureFromMoonrakerDirect } from "@/lib/services/edge-capture-service";
import { enqueueEdgeCommand } from "@/lib/services/edge-command-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ deviceId: string }> };

async function resolveLinkedTrayId(
  deviceId: string,
  ownerEmail: string,
  trayId?: string
): Promise<string | undefined> {
  if (trayId) return trayId;
  const { requirePostgresPool } = await import("@/lib/db/postgres");
  const pool = requirePostgresPool();
  const linked = await pool.query<{ id: string }>(
    `SELECT id FROM tray_systems
     WHERE edge_device_id = $1 AND owner_email = $2
     LIMIT 1`,
    [deviceId, ownerEmail.toLowerCase()]
  );
  return linked.rows[0]?.id;
}

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
 * Actions: capture | linkTray | revoke | rotateKey | updateLimits | updateMoonrakerUrl
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
      moonrakerUrl?: string;
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
      const trayId = await resolveLinkedTrayId(
        deviceId,
        auth.email,
        body.trayId
      );
      if (!trayId) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "No tray linked to this device",
          400
        );
      }

      const runPoses = Boolean(body.runPoses);

      // Fast path: server fetches Moonraker snapshot when reachable (single-shot only).
      // Pose walks need the Pi agent for actuators, so they always queue.
      if (!runPoses && device.moonrakerUrl?.trim()) {
        try {
          const direct = await captureFromMoonrakerDirect({
            ownerEmail: auth.email,
            deviceId,
            trayId,
            plantId: body.plantId,
            moonrakerUrl: device.moonrakerUrl.trim(),
            notes: "take_picture_server_direct"
          });
          return NextResponse.json({
            message: "Picture captured",
            queued: false,
            data: {
              captureId: direct.capture.id,
              imageUrl: direct.imageUrl,
              bytes: direct.bytes,
              capturedAt: direct.capture.capturedAt,
              snapshotUrl: direct.snapshotUrl,
              trayId,
              plantId: body.plantId ?? null
            }
          });
        } catch (directError) {
          // Fall through to Pi agent queue when LAN/NAT blocks server → Moonraker.
          console.warn(
            "[devices/capture] direct Moonraker snapshot failed; queueing agent fallback:",
            directError instanceof Error ? directError.message : directError
          );
        }
      }

      const cmd = await enqueueEdgeCommand({
        deviceId,
        trayId,
        plantId: body.plantId,
        commandType: "capture_now",
        payload: {
          runPoses,
          requestedBy: auth.email
        }
      });
      return NextResponse.json({
        message: runPoses
          ? "Pose capture queued. The Pi agent will claim it on the next heartbeat."
          : (() => {
              const mr = device.moonrakerUrl?.trim() ?? "";
              const loopback =
                /:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(mr);
              if (loopback) {
                return "Moonraker URL is loopback (127.0.0.1); update it to the Pi LAN IP or a tunnel URL, or wait for the Pi agent.";
              }
              return mr
                ? "Moonraker not reachable from the server; capture queued for the Pi agent."
                : "Capture command queued. The Pi agent will claim it on the next heartbeat.";
            })(),
        queued: true,
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

    if (body.action === "updateMoonrakerUrl") {
      if (!body.moonrakerUrl?.trim()) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "moonrakerUrl is required",
          400
        );
      }
      try {
        const updated = await updateEdgeDeviceMoonrakerUrl({
          ownerEmail: auth.email,
          deviceId,
          moonrakerUrl: body.moonrakerUrl
        });
        if (!updated) {
          return apiErrorResponse(
            API_ERROR_CODES.NOT_FOUND,
            "Device not found",
            404
          );
        }
        return NextResponse.json({
          data: updated,
          message: "Moonraker URL updated"
        });
      } catch (err) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          err instanceof Error ? err.message : "Invalid moonrakerUrl",
          400
        );
      }
    }

    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Unknown action. Use capture, linkTray, revoke, rotateKey, updateLimits, or updateMoonrakerUrl.",
      400
    );
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
