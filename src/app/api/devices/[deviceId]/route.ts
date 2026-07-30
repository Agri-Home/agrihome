import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireApiAccountUser } from "@/lib/auth/session";
import { updateDeviceActuatorLimits } from "@/lib/services/capture-pose-service";
import {
  deleteEdgeDevice,
  getEdgeDeviceById,
  linkDeviceToTray,
  revokeEdgeDevice,
  rotateEdgeDeviceKey,
  updateEdgeDeviceCameraServerUrl,
  updateEdgeDeviceKlipperUrl
} from "@/lib/services/edge-device-service";
import {
  captureFromCameraServerDirect
} from "@/lib/services/edge-capture-service";
import {
  setCameraServerLed,
  setCameraServerServo
} from "@/lib/services/camera-server-client";
import {
  enqueueEdgeCommand,
  getEdgeCommandForOwner
} from "@/lib/services/edge-command-service";

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

/** GET /api/devices/[deviceId] — optional ?commandId= to poll a queued capture */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireApiAccountUser();
  if (auth instanceof Response) return auth;
  const { deviceId } = await context.params;

  try {
    const device = await getEdgeDeviceById(deviceId);
    if (!device || device.ownerEmail !== auth.email.toLowerCase()) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Device not found", 404);
    }
    const commandId = new URL(request.url).searchParams.get("commandId")?.trim();
    if (commandId) {
      const command = await getEdgeCommandForOwner(auth.email, commandId);
      if (!command || command.deviceId !== deviceId) {
        return apiErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          "Command not found",
          404
        );
      }
      return NextResponse.json({ data: device, command });
    }
    return NextResponse.json({ data: device });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}

/**
 * POST /api/devices/[deviceId]
 * Actions: capture | getPosition | linkTray | revoke | delete | rotateKey |
 *          updateLimits | updateKlipperUrl | updateCameraServerUrl |
 *          cameraServo | cameraLed | cameraPhoto
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
      hingeDeg?: number;
      motorMm?: number;
      klipperUrl?: string;
      /** @deprecated Prefer klipperUrl / updateKlipperUrl. */
      moonrakerUrl?: string;
      cameraServerUrl?: string;
      angle?: number;
      rgb?: [number, number, number] | number[];
      width?: number;
      height?: number;
      rotation?: number;
      actuatorLimits?: {
        hingeMinDeg?: number;
        hingeMaxDeg?: number;
        motorMinMm?: number;
        motorMaxMm?: number;
      };
    };

    // Alias for older Vision Console clients.
    if (body.action === "updateMoonrakerUrl") {
      body.action = "updateKlipperUrl";
      body.klipperUrl = body.klipperUrl ?? body.moonrakerUrl;
    }

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

      // Primary Take Picture path: Pi Zero camera_server.py GET /photo
      // (rpicam-still). Do not use Moonraker/webcam streamer here — that URL is
      // for optional legacy stills only. Pose walks still queue for the agent.
      let reachabilityError: string | null = null;
      if (!runPoses && device.cameraServerUrl?.trim()) {
        try {
          const direct = await captureFromCameraServerDirect({
            ownerEmail: auth.email,
            deviceId,
            trayId,
            plantId: body.plantId,
            cameraServerUrl: device.cameraServerUrl.trim(),
            notes: "take_picture_pi0_camera_server",
            hingeDeg:
              body.hingeDeg != null && Number.isFinite(body.hingeDeg)
                ? body.hingeDeg
                : undefined,
            motorMm:
              body.motorMm != null && Number.isFinite(body.motorMm)
                ? body.motorMm
                : undefined
          });
          return NextResponse.json({
            message: "Picture captured from Pi0 camera_server.py",
            queued: false,
            data: {
              captureId: direct.capture.id,
              imageUrl: direct.imageUrl,
              bytes: direct.bytes,
              capturedAt: direct.capture.capturedAt,
              snapshotUrl: direct.snapshotUrl,
              trayId,
              plantId: direct.plantId,
              plantCreated: direct.plantCreated,
              hingeDeg: direct.capture.hingeDeg ?? null,
              motorMm: direct.capture.motorMm ?? null
            }
          });
        } catch (directError) {
          reachabilityError =
            directError instanceof Error
              ? directError.message
              : String(directError);
          console.warn(
            "[devices/capture] Pi0 camera_server.py failed; queueing agent capture:",
            reachabilityError
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
              if (!device.cameraServerUrl?.trim()) {
                return "Set the Pi0 camera server URL (camera_server.py :5000), or wait for the Pi agent capture queue.";
              }
              if (reachabilityError) {
                return `Pi0 camera_server.py not reachable (${reachabilityError}); capture queued for the Pi agent.`;
              }
              return "Capture queued for the Pi agent.";
            })(),
        queued: true,
        reachabilityError,
        data: cmd
      });
    }

    if (body.action === "getPosition") {
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
      const cmd = await enqueueEdgeCommand({
        deviceId,
        trayId,
        plantId: body.plantId,
        commandType: "get_position",
        payload: { requestedBy: auth.email }
      });
      return NextResponse.json({
        message:
          "Position query queued. The Pi agent will report hinge/motor on the next heartbeat.",
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

    if (body.action === "delete" || body.action === "unregister") {
      const deleted = await deleteEdgeDevice(auth.email, deviceId);
      if (!deleted) {
        return apiErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          "Device not found",
          404
        );
      }
      return NextResponse.json({
        data: { id: deviceId },
        message: "Device unregistered"
      });
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

    if (body.action === "updateKlipperUrl") {
      if (!body.klipperUrl?.trim()) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "klipperUrl is required",
          400
        );
      }
      try {
        const updated = await updateEdgeDeviceKlipperUrl({
          ownerEmail: auth.email,
          deviceId,
          klipperUrl: body.klipperUrl
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
          message: "Klipper URL updated"
        });
      } catch (err) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          err instanceof Error ? err.message : "Invalid klipperUrl",
          400
        );
      }
    }

    if (body.action === "updateCameraServerUrl") {
      try {
        const updated = await updateEdgeDeviceCameraServerUrl({
          ownerEmail: auth.email,
          deviceId,
          cameraServerUrl: body.cameraServerUrl ?? ""
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
          message: updated.cameraServerUrl
            ? "Pi0 camera server URL updated"
            : "Pi0 camera server URL cleared"
        });
      } catch (err) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          err instanceof Error ? err.message : "Invalid cameraServerUrl",
          400
        );
      }
    }

    if (
      body.action === "cameraServo" ||
      body.action === "cameraLed" ||
      body.action === "cameraPhoto"
    ) {
      if (device.revokedAt) {
        return apiErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          "Device is revoked",
          403
        );
      }
      const cameraServerUrl = device.cameraServerUrl?.trim();
      if (!cameraServerUrl) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "Set the Pi0 camera server URL first (camera_server.py on :5000)",
          400
        );
      }

      if (body.action === "cameraServo") {
        try {
          const result = await setCameraServerServo({
            cameraServerUrl,
            angle: Number(body.angle)
          });
          return NextResponse.json({
            message: `Servo moved to ${result.angle}°`,
            data: result
          });
        } catch (err) {
          return apiErrorResponse(
            API_ERROR_CODES.BAD_GATEWAY,
            err instanceof Error ? err.message : "Servo move failed",
            502
          );
        }
      }

      if (body.action === "cameraLed") {
        const rgb = body.rgb;
        if (!Array.isArray(rgb) || rgb.length !== 3) {
          return apiErrorResponse(
            API_ERROR_CODES.BAD_REQUEST,
            "rgb must be [R,G,B] with three 0–255 values",
            400
          );
        }
        try {
          const result = await setCameraServerLed({
            cameraServerUrl,
            rgb: [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])]
          });
          return NextResponse.json({
            message: "LED color updated",
            data: result
          });
        } catch (err) {
          return apiErrorResponse(
            API_ERROR_CODES.BAD_GATEWAY,
            err instanceof Error ? err.message : "LED update failed",
            502
          );
        }
      }

      // cameraPhoto
      const trayId = await resolveLinkedTrayId(
        deviceId,
        auth.email,
        body.trayId
      );
      if (!trayId) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "Device is not linked to a tray",
          400
        );
      }
      try {
        const result = await captureFromCameraServerDirect({
          ownerEmail: auth.email,
          deviceId,
          trayId,
          plantId: body.plantId,
          cameraServerUrl,
          hingeDeg:
            body.hingeDeg != null && Number.isFinite(Number(body.hingeDeg))
              ? Number(body.hingeDeg)
              : undefined,
          motorMm:
            body.motorMm != null && Number.isFinite(Number(body.motorMm))
              ? Number(body.motorMm)
              : undefined,
          width: body.width,
          height: body.height,
          rotation: body.rotation
        });
        return NextResponse.json({
          message: "Photo captured from Pi0 camera server",
          queued: false,
          data: {
            capture: result.capture,
            imageUrl: result.imageUrl,
            plantId: result.plantId,
            plantCreated: result.plantCreated,
            snapshotUrl: result.snapshotUrl
          }
        });
      } catch (err) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_GATEWAY,
          err instanceof Error ? err.message : "Pi0 photo capture failed",
          502
        );
      }
    }

    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Unknown action. Use capture, getPosition, linkTray, revoke, delete, rotateKey, updateLimits, updateKlipperUrl, updateCameraServerUrl, cameraServo, cameraLed, or cameraPhoto.",
      400
    );
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
