import { createHash } from "crypto";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { checkRateLimit } from "@/lib/api/rate-limit-memory";
import {
  DEVICE_API_KEY_HEADER,
  requireDeviceApiKey
} from "@/lib/auth/device-auth";
import { env } from "@/lib/config/env";
import { requirePostgresPool } from "@/lib/db/postgres";
import { ingestCameraCapture } from "@/lib/services/camera-service";
import { completeEdgeCommand } from "@/lib/services/edge-command-service";
import { savePlantLeafOriginal, type LeafImageExt } from "@/lib/storage/save-original";
import { getTrayById } from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WINDOW_MS = 60_000;

function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    return xf.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function extFromMime(mime: string): LeafImageExt | null {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * POST /api/raspberry-pi/ingest
 * Multipart image ingest for Moonraker / Pi agents.
 * Auth: X-Agrihome-Device-Key (not Firebase session).
 *
 * Fields:
 *   image (file, required) — JPEG/PNG/WebP
 *   trayId (optional) — defaults to tray linked to this device
 *   plantId, capturedAt, hingeDeg, motorMm, poseOrder, notes, commandId (optional)
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const ipLimit = checkRateLimit(
    `pi-ingest-ip:${ip}`,
    env.device.ingestMaxPerIpPerMin,
    WINDOW_MS
  );
  if (!ipLimit.ok) {
    return apiErrorResponse(
      API_ERROR_CODES.RATE_LIMITED,
      "Too many ingest requests from this network.",
      429,
      { headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
    );
  }

  const auth = await requireDeviceApiKey(request);
  if (auth instanceof Response) {
    return auth;
  }

  const deviceLimit = checkRateLimit(
    `pi-ingest-dev:${auth.id}`,
    env.device.ingestMaxPerDevicePerMin,
    WINDOW_MS
  );
  if (!deviceLimit.ok) {
    return apiErrorResponse(
      API_ERROR_CODES.RATE_LIMITED,
      "Device ingest rate limit exceeded.",
      429,
      { headers: { "Retry-After": String(deviceLimit.retryAfterSec) } }
    );
  }

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        "Invalid multipart body",
        400
      );
    }

    const file = form.get("image");
    if (!(file instanceof File)) {
      return apiErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        'Multipart field "image" is required',
        400
      );
    }

    if (file.size > env.device.ingestMaxBytes) {
      return apiErrorResponse(
        API_ERROR_CODES.PAYLOAD_TOO_LARGE,
        `Image exceeds max size of ${env.device.ingestMaxBytes} bytes`,
        413
      );
    }

    const mime = file.type || "application/octet-stream";
    const ext = extFromMime(mime);
    if (!ext) {
      return apiErrorResponse(
        API_ERROR_CODES.UNSUPPORTED_MEDIA,
        "Only JPEG, PNG, and WebP images are accepted",
        415
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await savePlantLeafOriginal(buffer, ext);

    const trayIdForm = String(form.get("trayId") ?? "").trim();
    let tray = trayIdForm
      ? await getTrayById(auth.ownerEmail, trayIdForm)
      : null;

    if (!tray) {
      const pool = requirePostgresPool();
      const linked = await pool.query<{
        id: string;
        name: string;
      }>(
        `SELECT id, name FROM tray_systems
         WHERE edge_device_id = $1 AND owner_email = $2
         LIMIT 1`,
        [auth.id, auth.ownerEmail]
      );
      if (!linked.rows[0]) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "No tray linked to this device; pass trayId or re-register",
          400
        );
      }
      tray = await getTrayById(auth.ownerEmail, linked.rows[0].id);
    }

    if (!tray) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Tray not found", 404);
    }

    if (tray.edgeDeviceId && tray.edgeDeviceId !== auth.id) {
      return apiErrorResponse(
        API_ERROR_CODES.FORBIDDEN,
        "Tray is linked to a different edge device",
        403
      );
    }

    const plantId = String(form.get("plantId") ?? "").trim() || undefined;
    const notes = String(form.get("notes") ?? "").trim() || undefined;
    const commandId = String(form.get("commandId") ?? "").trim() || undefined;
    const capturedAt = String(form.get("capturedAt") ?? "").trim() || undefined;
    const hingeDeg = parseOptionalNumber(form.get("hingeDeg"));
    const motorMm = parseOptionalNumber(form.get("motorMm"));
    const poseOrder = parseOptionalNumber(form.get("poseOrder"));

    const capture = await ingestCameraCapture({
      trayId: tray.id,
      trayName: tray.name,
      deviceId: auth.id,
      imageUrl: saved.imageUrl,
      capturedAt,
      notes,
      source: "hardware",
      plantId,
      hingeDeg,
      motorMm,
      poseOrder: poseOrder != null ? Math.round(poseOrder) : undefined,
      commandId
    });

    const pool = requirePostgresPool();
    await pool.query(
      `UPDATE tray_systems SET last_capture_at = $1 WHERE id = $2`,
      [capture.capturedAt, tray.id]
    );

    if (plantId) {
      await pool.query(
        `UPDATE plants
         SET last_image_url = $1, last_image_at = $2
         WHERE id = $3 AND tray_id = $4 AND owner_email = $5`,
        [
          saved.imageUrl,
          capture.capturedAt,
          plantId,
          tray.id,
          auth.ownerEmail
        ]
      );
    }

    if (commandId) {
      await completeEdgeCommand({
        commandId,
        deviceId: auth.id,
        status: "completed",
        result: {
          captureId: capture.id,
          imageUrl: saved.imageUrl,
          sha256: createHash("sha256").update(buffer).digest("hex")
        }
      });
    }

    // Optional async CV — fire-and-forget; failures must not fail ingest.
    if (env.device.autoVisionOnIngest) {
      void import("@/lib/services/edge-vision-hook").then((m) =>
        m.triggerVisionAfterPiIngest({
          ownerEmail: auth.ownerEmail,
          trayId: tray!.id,
          captureId: capture.id,
          imageUrl: saved.imageUrl,
          absolutePath: saved.absolutePath
        })
      );
    }

    return NextResponse.json({
      message: "Camera frame accepted",
      data: {
        captureId: capture.id,
        trayId: tray.id,
        deviceId: auth.id,
        imageUrl: saved.imageUrl,
        bytes: saved.bytes,
        capturedAt: capture.capturedAt,
        plantId: plantId ?? null,
        hingeDeg: hingeDeg ?? null,
        motorMm: motorMm ?? null,
        poseOrder: poseOrder ?? null
      }
    });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/raspberry-pi/ingest",
    auth: DEVICE_API_KEY_HEADER,
    accepts: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: env.device.ingestMaxBytes,
    fields: [
      "image",
      "trayId?",
      "plantId?",
      "capturedAt?",
      "hingeDeg?",
      "motorMm?",
      "poseOrder?",
      "notes?",
      "commandId?"
    ]
  });
}
