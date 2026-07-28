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
  updateEdgeDeviceKlipperUrl
} from "@/lib/services/edge-device-service";
import {
  captureFromKlipperStreamerDirect,
  summarizeStreamerReachabilityError
} from "@/lib/services/edge-capture-service";
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
 *          updateLimits | updateKlipperUrl
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

      // Optional fast path: HTTP streamer still (crowsnest/nginx) when a LAN URL
      // is stored. Primary path for Agri-Home/klipper is the Pi agent + fswebcam
      // (camera-macros/save_image.sh). Pose walks always queue for the agent.
      let reachabilityError: string | null = null;
      if (!runPoses && device.klipperUrl?.trim()) {
        try {
          const direct = await captureFromKlipperStreamerDirect({
            ownerEmail: auth.email,
            deviceId,
            trayId,
            plantId: body.plantId,
            klipperUrl: device.klipperUrl.trim(),
            notes: "take_picture_server_direct",
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
            message: "Picture captured",
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
          reachabilityError = summarizeStreamerReachabilityError(directError);
          console.warn(
            "[devices/capture] optional HTTP streamer failed; queueing agent fswebcam capture:",
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
              const url = device.klipperUrl?.trim() ?? "";
              const loopback =
                /:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(url);
              if (loopback) {
                return "Streamer URL is loopback (127.0.0.1); update it to the Pi LAN IP, or wait for the Pi agent (fswebcam).";
              }
              if (reachabilityError) {
                return `HTTP streamer not reachable (${reachabilityError}); capture queued for the Pi agent (fswebcam / Klipper).`;
              }
              return url
                ? "HTTP streamer not reachable from the server; capture queued for the Pi agent."
                : "Capture queued for the Pi agent (fswebcam via Agri-Home/klipper camera-macros).";
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

    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Unknown action. Use capture, getPosition, linkTray, revoke, delete, rotateKey, updateLimits, or updateKlipperUrl.",
      400
    );
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
