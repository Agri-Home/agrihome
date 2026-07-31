/**
 * Client for the Pi Zero Flask camera_server.py (klipper/camera_server.py).
 *
 * Endpoints (host 0.0.0.0:5000):
 *   GET /servo?angle=0..90
 *   GET /led?rgb=R,G,B   (server swaps R/G for NeoPixel wiring)
 *   GET /photo?width=&height=&rotation=  → JPEG
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const PHOTO_TIMEOUT_MS = 60_000;

export function normalizeCameraServerBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function assertCameraServerHttpUrl(url: string): URL {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("cameraServerUrl is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("cameraServerUrl must be a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("cameraServerUrl must use http or https");
  }
  return parsed;
}

async function cameraServerFetch(
  baseUrl: string,
  pathAndQuery: string,
  timeoutMs: number
): Promise<Response> {
  const base = normalizeCameraServerBase(baseUrl);
  const url = `${base}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store"
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Pi0 camera server timed out after ${timeoutMs}ms (${url})`);
    }
    throw new Error(
      `Pi0 camera server unreachable (${url}): ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function setCameraServerServo(input: {
  cameraServerUrl: string;
  angle: number;
}): Promise<{ status: string; angle: number }> {
  const angle = Math.round(input.angle);
  if (!Number.isFinite(angle) || angle < 0 || angle > 90) {
    throw new Error("Servo angle must be an integer between 0 and 90");
  }
  const res = await cameraServerFetch(
    input.cameraServerUrl,
    `/servo?angle=${encodeURIComponent(String(angle))}`,
    DEFAULT_TIMEOUT_MS
  );
  const json = (await res.json().catch(() => null)) as {
    status?: string;
    angle?: number;
    message?: string;
  } | null;
  if (!res.ok) {
    throw new Error(
      json?.message ?? `Servo request failed (HTTP ${res.status})`
    );
  }
  return {
    status: json?.status ?? "success",
    angle: json?.angle ?? angle
  };
}

export async function setCameraServerLed(input: {
  cameraServerUrl: string;
  /** RGB 0–255 as accepted by camera_server /led?rgb= (wiring swaps R/G on device). */
  rgb: [number, number, number];
}): Promise<{
  status: string;
  color: { red: number; green: number; blue: number };
}> {
  const [r, g, b] = input.rgb.map((n) => Math.round(n));
  for (const n of [r, g, b]) {
    if (!Number.isFinite(n) || n < 0 || n > 255) {
      throw new Error("LED RGB values must be integers 0–255");
    }
  }
  const res = await cameraServerFetch(
    input.cameraServerUrl,
    `/led?rgb=${encodeURIComponent(`${r},${g},${b}`)}`,
    DEFAULT_TIMEOUT_MS
  );
  const json = (await res.json().catch(() => null)) as {
    status?: string;
    color?: { red: number; green: number; blue: number };
    message?: string;
  } | null;
  if (!res.ok) {
    throw new Error(json?.message ?? `LED request failed (HTTP ${res.status})`);
  }
  return {
    status: json?.status ?? "success",
    color: json?.color ?? { red: g, green: r, blue: b }
  };
}

export async function fetchCameraServerPhoto(input: {
  cameraServerUrl: string;
  width?: number;
  height?: number;
  rotation?: number;
  crop?: string;
  cropFraction?: number;
}): Promise<{ buffer: Buffer; contentType: string; photoUrl: string }> {
  const width = input.width ?? 1920;
  const height = input.height ?? 1080;
  const rotation = input.rotation ?? 180;
  if (![0, 90, 180, 270].includes(rotation)) {
    throw new Error("Photo rotation must be 0, 90, 180, or 270");
  }
  const qs = new URLSearchParams({
    width: String(width),
    height: String(height),
    rotation: String(rotation)
  });
  if (input.crop) {
    qs.set("crop", input.crop);
  }
  if (input.cropFraction != null) {
    qs.set("crop_fraction", String(input.cropFraction));
  }
  const path = `/photo?${qs.toString()}`;
  const base = normalizeCameraServerBase(input.cameraServerUrl);
  const photoUrl = `${base}${path}`;
  const res = await cameraServerFetch(
    input.cameraServerUrl,
    path,
    PHOTO_TIMEOUT_MS
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      json?.message ?? `Photo capture failed (HTTP ${res.status})`
    );
  }
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.includes("image")) {
    throw new Error(
      `Pi0 /photo returned unexpected content-type: ${contentType}`
    );
  }
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), contentType, photoUrl };
}
