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
  enqueueEdgeCommand,
  getEdgeCommandForOwner
} from "@/lib/services/edge-command-service";
import { getDeveloperMode } from "@/lib/services/user-preferences-service";

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
 * Actions: capture | getPosition | moveActuators | runGcode | homeAxes |
 *          linkTray | revoke | delete | rotateKey | updateLimits |
 *          updateKlipperUrl | updateCameraServerUrl | cameraServo |
 *          cameraLed | cameraPhoto
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
      /** Freeform Klipper G-code / macro script for runGcode. */
      gcode?: string;
      /** When true, agent skips Moonraker POST (log only). */
      dryRun?: boolean;
      feedrate?: number;
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

    const developerActions = new Set([
      "capture",
      "getPosition",
      "moveActuators",
      "runGcode",
      "homeAxes",
      "cameraServo",
      "cameraLed",
      "cameraPhoto"
    ]);
    if (body.action && developerActions.has(body.action)) {
      const allowed = await getDeveloperMode(auth.email);
      if (!allowed) {
        return apiErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          "Enable Developer tools in Settings to use manual Pi / Klipper controls",
          403
        );
      }
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

      // Pi0 Take Picture: queue camera_photo for the LAN agent (agrihome.tech
      // cannot reach 192.168.x camera_server URLs). Pose walks use capture_now.
      if (!runPoses && device.cameraServerUrl?.trim()) {
        const cmd = await enqueueEdgeCommand({
          deviceId,
          trayId,
          plantId: body.plantId,
          commandType: "camera_photo",
          payload: {
            cameraServerUrl: device.cameraServerUrl.trim(),
            requestedBy: auth.email,
            hingeDeg:
              body.hingeDeg != null && Number.isFinite(body.hingeDeg)
                ? body.hingeDeg
                : undefined,
            motorMm:
              body.motorMm != null && Number.isFinite(body.motorMm)
                ? body.motorMm
                : undefined
          }
        });
        return NextResponse.json({
          message:
            "Pi0 photo queued. The edge agent will call camera_server.py /photo on the next heartbeat.",
          queued: true,
          data: cmd
        });
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
          : "Capture queued for the Pi agent (fswebcam / camera-macros).",
        queued: true,
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

    if (body.action === "moveActuators") {
      if (device.revokedAt) {
        return apiErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          "Device is revoked",
          403
        );
      }
      const hingeDeg = Number(body.hingeDeg);
      const motorMm = Number(body.motorMm);
      if (!Number.isFinite(hingeDeg) || !Number.isFinite(motorMm)) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "hingeDeg and motorMm are required numbers",
          400
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
        commandType: "move_actuators",
        payload: {
          hingeDeg,
          motorMm,
          feedrate:
            body.feedrate != null && Number.isFinite(Number(body.feedrate))
              ? Number(body.feedrate)
              : 1200,
          dryRun: body.dryRun === true,
          requestedBy: auth.email
        }
      });
      return NextResponse.json({
        message: body.dryRun
          ? `Dry-run move queued (hinge ${hingeDeg}° · motor ${motorMm} mm).`
          : `Stepper move queued (hinge ${hingeDeg}° · motor ${motorMm} mm).`,
        queued: true,
        data: cmd
      });
    }

    if (body.action === "runGcode") {
      if (device.revokedAt) {
        return apiErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          "Device is revoked",
          403
        );
      }
      const gcode = (body.gcode ?? "").trim();
      if (!gcode) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "gcode script is required",
          400
        );
      }
      if (gcode.length > 4000) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "gcode script is too long (max 4000 chars)",
          400
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
        commandType: "run_gcode",
        payload: {
          gcode,
          dryRun: body.dryRun === true,
          requestedBy: auth.email
        }
      });
      return NextResponse.json({
        message: body.dryRun
          ? "Dry-run G-code queued for the edge agent."
          : "G-code queued for the edge agent (Moonraker).",
        queued: true,
        data: cmd
      });
    }

    if (body.action === "homeAxes") {
      if (device.revokedAt) {
        return apiErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          "Device is revoked",
          403
        );
      }
      // Optional override (e.g. "G28 X Y"); default full home.
      const gcode = ((body.gcode ?? "G28") as string).trim() || "G28";
      if (gcode.length > 4000) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "gcode script is too long (max 4000 chars)",
          400
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
        commandType: "run_gcode",
        payload: {
          gcode,
          dryRun: false,
          purpose: "home_axes",
          requestedBy: auth.email
        }
      });
      return NextResponse.json({
        message: `Homing queued (${gcode}). Required before moves if Klipper reports “Must home axis first”.`,
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

      const trayId = await resolveLinkedTrayId(
        deviceId,
        auth.email,
        body.trayId
      );

      if (body.action === "cameraServo") {
        const angle = Number(body.angle);
        if (!Number.isFinite(angle) || angle < 0 || angle > 90) {
          return apiErrorResponse(
            API_ERROR_CODES.BAD_REQUEST,
            "Servo angle must be 0–90",
            400
          );
        }
        const cmd = await enqueueEdgeCommand({
          deviceId,
          trayId,
          commandType: "camera_servo",
          payload: {
            cameraServerUrl,
            angle,
            requestedBy: auth.email
          }
        });
        return NextResponse.json({
          message: `Servo ${angle}° queued for the edge agent (camera_server.py).`,
          queued: true,
          data: cmd
        });
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
        const cmd = await enqueueEdgeCommand({
          deviceId,
          trayId,
          commandType: "camera_led",
          payload: {
            cameraServerUrl,
            rgb: [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])],
            requestedBy: auth.email
          }
        });
        return NextResponse.json({
          message: "LED update queued for the edge agent (camera_server.py).",
          queued: true,
          data: cmd
        });
      }

      // cameraPhoto
      if (!trayId) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "Device is not linked to a tray",
          400
        );
      }
      const cmd = await enqueueEdgeCommand({
        deviceId,
        trayId,
        plantId: body.plantId,
        commandType: "camera_photo",
        payload: {
          cameraServerUrl,
          requestedBy: auth.email,
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
        }
      });
      return NextResponse.json({
        message:
          "Pi0 photo queued. The edge agent will call camera_server.py /photo on the next heartbeat.",
        queued: true,
        data: cmd
      });
    }

    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Unknown action. Use capture, getPosition, moveActuators, runGcode, homeAxes, linkTray, revoke, delete, rotateKey, updateLimits, updateKlipperUrl, updateCameraServerUrl, cameraServo, cameraLed, or cameraPhoto.",
      400
    );
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
