import { createHash } from "crypto";

import { env } from "@/lib/config/env";
import { requirePostgresPool } from "@/lib/db/postgres";
import { ingestCameraCapture } from "@/lib/services/camera-service";
import { postprocessEdgeCapture } from "@/lib/services/edge-capture-postprocess";
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
  plantId: string;
  plantCreated: boolean;
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

function resolveSnapshotUrl(klipperUrl: string, snapshotPath: string): string {
  const trimmed = snapshotPath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const base = klipperUrl.replace(/\/+$/, "");
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

/**
 * Klipper stacks often expose webcam stills on nginx :80 while Klipper API
 * stays on :7125. When the stored URL is :7125, also try the same host on :80.
 */
function candidateStreamerBases(klipperUrl: string): string[] {
  const base = klipperUrl.replace(/\/+$/, "");
  const bases = [base];
  try {
    const u = new URL(base);
    if (u.port === "7125") {
      const viaHttp = `${u.protocol}//${u.hostname}`;
      if (!bases.includes(viaHttp)) bases.push(viaHttp);
    }
  } catch {
    // ignore invalid URL; fetch will surface the error
  }
  return bases;
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

async function listWebcamSnapshotUrls(klipperUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const bases = candidateStreamerBases(klipperUrl);
  for (const base of bases) {
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
      if (!res.ok) continue;
      const json = (await res.json()) as {
        result?: { webcams?: Array<{ enabled?: boolean; snapshot_url?: string }> };
        webcams?: Array<{ enabled?: boolean; snapshot_url?: string }>;
      };
      const webcams = json.result?.webcams ?? json.webcams ?? [];
      for (const w of webcams) {
        if (w.enabled === false || !w.snapshot_url?.trim()) continue;
        const snap = w.snapshot_url.trim();
        // Relative paths (e.g. /webcam/?action=snapshot) often live on nginx :80
        // while Klipper API is on :7125 — resolve against every candidate base.
        const resolveBases = snap.startsWith("http://") || snap.startsWith("https://")
          ? [base]
          : bases;
        for (const b of resolveBases) {
          const resolved = resolveSnapshotUrl(b, snap);
          if (!urls.includes(resolved)) urls.push(resolved);
        }
      }
    } catch {
      // try next base
    } finally {
      clearTimeout(timer);
    }
  }
  return urls;
}

/** Short operator-facing reason when server → Klipper snapshot fails. */
export function summarizeStreamerReachabilityError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout after|AbortError/i.test(msg)) {
    return "timeout reaching Pi (if Cloudflare WARP is on, run: warp-cli override local-network allow)";
  }
  if (/ECONNREFUSED|connection refused/i.test(msg)) {
    return "connection refused";
  }
  if (/ENETUNREACH|EHOSTUNREACH|other side closed|fetch failed/i.test(msg)) {
    return "network unreachable (check Pi IP / WARP LAN override)";
  }
  if (/HTTP 404/i.test(msg)) {
    return "snapshot 404 on tried URLs (webcam is often on http://PI_IP/webcam/?action=snapshot, not :7125)";
  }
  const trimmed = msg.replace(/^Could not fetch Klipper snapshot from \S+:\s*/i, "");
  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}…` : trimmed;
}

async function fetchSnapshotBytes(
  klipperUrl: string,
  snapshotPath?: string | null
): Promise<{ buffer: Buffer; snapshotUrl: string; contentType: string | null }> {
  const urls: string[] = [];
  for (const base of candidateStreamerBases(klipperUrl)) {
    for (const path of candidateSnapshotPaths(snapshotPath)) {
      const url = resolveSnapshotUrl(base, path);
      if (!urls.includes(url)) urls.push(url);
    }
  }
  for (const url of await listWebcamSnapshotUrls(klipperUrl)) {
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
    `Could not fetch Klipper snapshot from ${klipperUrl}: ${errors.join("; ")}`
  );
}

/**
 * Fetch a still frame from the device's Klipper webcam (when reachable from
 * the AgriHome server) and persist it as a camera capture.
 */
export async function captureFromKlipperStreamerDirect(input: {
  ownerEmail: string;
  deviceId: string;
  trayId: string;
  plantId?: string;
  klipperUrl: string;
  snapshotPath?: string | null;
  notes?: string;
  hingeDeg?: number;
  motorMm?: number;
}): Promise<DirectCaptureResult> {
  const ownerEmail = input.ownerEmail.toLowerCase();
  const tray = await getTrayById(ownerEmail, input.trayId);
  if (!tray) {
    throw new Error("Tray not found");
  }

  const { buffer, snapshotUrl, contentType } = await fetchSnapshotBytes(
    input.klipperUrl,
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
    plantId: input.plantId,
    hingeDeg: input.hingeDeg,
    motorMm: input.motorMm
  });

  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE tray_systems SET last_capture_at = $1 WHERE id = $2`,
    [capture.capturedAt, tray.id]
  );

  const attached = await postprocessEdgeCapture({
    ownerEmail,
    trayId: tray.id,
    capture,
    imageUrl: saved.imageUrl,
    absolutePath: saved.absolutePath,
    plantId: input.plantId,
    deviceId: input.deviceId,
    hingeDeg: input.hingeDeg ?? null,
    motorMm: input.motorMm ?? null
  });

  return {
    capture,
    imageUrl: saved.imageUrl,
    bytes: saved.bytes,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    snapshotUrl,
    plantId: attached.plantId,
    plantCreated: attached.plantCreated
  };
}

/**
 * Capture via Pi Zero camera_server.py GET /photo and persist as a tray capture.
 */
export async function captureFromCameraServerDirect(input: {
  ownerEmail: string;
  deviceId: string;
  trayId: string;
  plantId?: string;
  cameraServerUrl: string;
  notes?: string;
  hingeDeg?: number;
  motorMm?: number;
  width?: number;
  height?: number;
  rotation?: number;
}): Promise<DirectCaptureResult> {
  const { fetchCameraServerPhoto } = await import(
    "@/lib/services/camera-server-client"
  );
  const ownerEmail = input.ownerEmail.toLowerCase();
  const tray = await getTrayById(ownerEmail, input.trayId);
  if (!tray) {
    throw new Error("Tray not found");
  }

  const { buffer, contentType, photoUrl } = await fetchCameraServerPhoto({
    cameraServerUrl: input.cameraServerUrl,
    width: input.width,
    height: input.height,
    rotation: input.rotation
  });
  const ext: LeafImageExt =
    extFromMime(contentType) ?? extFromBuffer(buffer) ?? "jpg";
  const saved = await savePlantLeafOriginal(buffer, ext);
  const capturedAt = new Date().toISOString();

  const capture = await ingestCameraCapture({
    trayId: tray.id,
    trayName: tray.name,
    deviceId: input.deviceId,
    imageUrl: saved.imageUrl,
    capturedAt,
    notes: input.notes ?? "pi0_camera_server_photo",
    source: "hardware",
    plantId: input.plantId,
    hingeDeg: input.hingeDeg,
    motorMm: input.motorMm
  });

  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE tray_systems SET last_capture_at = $1 WHERE id = $2`,
    [capture.capturedAt, tray.id]
  );

  const attached = await postprocessEdgeCapture({
    ownerEmail,
    trayId: tray.id,
    capture,
    imageUrl: saved.imageUrl,
    absolutePath: saved.absolutePath,
    plantId: input.plantId,
    deviceId: input.deviceId,
    hingeDeg: input.hingeDeg ?? null,
    motorMm: input.motorMm ?? null
  });

  return {
    capture,
    imageUrl: saved.imageUrl,
    bytes: saved.bytes,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    snapshotUrl: photoUrl,
    plantId: attached.plantId,
    plantCreated: attached.plantCreated
  };
}
