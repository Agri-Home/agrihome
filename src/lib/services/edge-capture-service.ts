import { createHash } from "crypto";

import { env } from "@/lib/config/env";
import { requirePostgresPool } from "@/lib/db/postgres";
import { ingestCameraCapture } from "@/lib/services/camera-service";
import { getTrayById } from "@/lib/services/topology-service";
import {
  savePlantLeafOriginal,
  type LeafImageExt
} from "@/lib/storage/save-original";
import type { CameraCapture } from "@/lib/types/domain";

export type DirectCaptureResult = {
  capture: CameraCapture;
  imageUrl: string;
  bytes: number;
  sha256: string;
  snapshotUrl: string;
};

const DEFAULT_SNAPSHOT_PATHS = [
  "/webcam/?action=snapshot",
  "/webcam?action=snapshot"
];

function extFromMime(mime: string): LeafImageExt | null {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

function extFromBuffer(buffer: Buffer): LeafImageExt | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function resolveSnapshotUrl(moonrakerUrl: string, snapshotPath: string): string {
  const trimmed = snapshotPath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const base = moonrakerUrl.replace(/\/+$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

function candidateSnapshotPaths(configured?: string | null): string[] {
  const paths: string[] = [];
  const preferred = configured?.trim() || env.device.snapshotPath;
  if (preferred) paths.push(preferred);
  for (const p of DEFAULT_SNAPSHOT_PATHS) {
    if (!paths.includes(p)) paths.push(p);
  }
  return paths;
}

async function listWebcamSnapshotUrls(moonrakerUrl: string): Promise<string[]> {
  const base = moonrakerUrl.replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.min(env.device.snapshotTimeoutMs, 5_000)
  );
  try {
    const res = await fetch(`${base}/server/webcams/list`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      result?: { webcams?: Array<{ enabled?: boolean; snapshot_url?: string }> };
      webcams?: Array<{ enabled?: boolean; snapshot_url?: string }>;
    };
    const webcams = json.result?.webcams ?? json.webcams ?? [];
    return webcams
      .filter((w) => w.enabled !== false && w.snapshot_url?.trim())
      .map((w) => resolveSnapshotUrl(base, w.snapshot_url!.trim()));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSnapshotBytes(
  moonrakerUrl: string,
  snapshotPath?: string | null
): Promise<{ buffer: Buffer; snapshotUrl: string; contentType: string | null }> {
  const urls: string[] = [];
  for (const path of candidateSnapshotPaths(snapshotPath)) {
    const url = resolveSnapshotUrl(moonrakerUrl, path);
    if (!urls.includes(url)) urls.push(url);
  }
  for (const url of await listWebcamSnapshotUrls(moonrakerUrl)) {
    if (!urls.includes(url)) urls.push(url);
  }

  const errors: string[] = [];
  for (const snapshotUrl of urls) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      env.device.snapshotTimeoutMs
    );
    try {
      const res = await fetch(snapshotUrl, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store"
      });
      if (!res.ok) {
        errors.push(`${snapshotUrl} -> HTTP ${res.status}`);
        continue;
      }
      const contentType = res.headers.get("content-type");
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.length) {
        errors.push(`${snapshotUrl} -> empty body`);
        continue;
      }
      const ext = extFromMime(contentType ?? "") ?? extFromBuffer(buffer);
      if (!ext) {
        errors.push(`${snapshotUrl} -> not a JPEG/PNG/WebP image`);
        continue;
      }
      return { buffer, snapshotUrl, contentType };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.name === "AbortError"
            ? `timeout after ${env.device.snapshotTimeoutMs}ms`
            : err.message
          : String(err);
      errors.push(`${snapshotUrl} -> ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    `Could not fetch Moonraker snapshot from ${moonrakerUrl}: ${errors.join("; ")}`
  );
}

/**
 * Fetch a still frame from the device's Moonraker webcam (when reachable from
 * the AgriHome server) and persist it as a camera capture.
 */
export async function captureFromMoonrakerDirect(input: {
  ownerEmail: string;
  deviceId: string;
  trayId: string;
  plantId?: string;
  moonrakerUrl: string;
  snapshotPath?: string | null;
  notes?: string;
}): Promise<DirectCaptureResult> {
  const ownerEmail = input.ownerEmail.toLowerCase();
  const tray = await getTrayById(ownerEmail, input.trayId);
  if (!tray) {
    throw new Error("Tray not found");
  }

  const { buffer, snapshotUrl, contentType } = await fetchSnapshotBytes(
    input.moonrakerUrl,
    input.snapshotPath
  );
  const ext: LeafImageExt =
    extFromMime(contentType ?? "") ?? extFromBuffer(buffer) ?? "jpg";
  const saved = await savePlantLeafOriginal(buffer, ext);
  const capturedAt = new Date().toISOString();

  const capture = await ingestCameraCapture({
    trayId: tray.id,
    trayName: tray.name,
    deviceId: input.deviceId,
    imageUrl: saved.imageUrl,
    capturedAt,
    notes: input.notes ?? "server_direct_capture",
    source: "hardware",
    plantId: input.plantId
  });

  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE tray_systems SET last_capture_at = $1 WHERE id = $2`,
    [capture.capturedAt, tray.id]
  );

  if (input.plantId) {
    await pool.query(
      `UPDATE plants
       SET last_image_url = $1, last_image_at = $2
       WHERE id = $3 AND tray_id = $4 AND owner_email = $5`,
      [
        saved.imageUrl,
        capture.capturedAt,
        input.plantId,
        tray.id,
        ownerEmail
      ]
    );
  }

  if (env.device.autoVisionOnIngest) {
    void import("@/lib/services/edge-vision-hook").then((m) =>
      m.triggerVisionAfterPiIngest({
        ownerEmail,
        trayId: tray.id,
        captureId: capture.id,
        imageUrl: saved.imageUrl,
        absolutePath: saved.absolutePath
      })
    );
  }

  return {
    capture,
    imageUrl: saved.imageUrl,
    bytes: saved.bytes,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    snapshotUrl
  };
}
