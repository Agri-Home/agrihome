import { createHash } from "crypto";

import { env } from "@/lib/config/env";
import { requirePostgresPool } from "@/lib/db/postgres";
import type { TrayPlantDetectionBox } from "@/lib/types/domain";

export interface TrayPlantVisionResult {
  count: number;
  countConfidence: number;
  instances: TrayPlantDetectionBox[];
  source: "simulated" | "remote";
}

type RemotePayload = {
  count?: unknown;
  countConfidence?: unknown;
  confidence?: unknown;
  instances?: unknown;
};

function parseBoxes(raw: unknown): TrayPlantDetectionBox[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: TrayPlantDetectionBox[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const o = item as Record<string, unknown>;
    const x = Number(o.x);
    const y = Number(o.y);
    const w = Number(o.w);
    const h = Number(o.h);
    const score = Number(o.score ?? o.confidence ?? 0.5);
    if (![x, y, w, h, score].every((n) => Number.isFinite(n))) {
      continue;
    }
    const label =
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined;
    out.push({ x, y, w, h, score, label });
  }
  return out;
}

function simulatedTrayVision(imageBytes: Buffer): TrayPlantVisionResult {
  const digest = createHash("sha256").update(imageBytes).digest();
  const maxPlants = 12;
  const count = 1 + (digest[0] % maxPlants);
  const jitter = (digest[1] / 255) * 0.22;
  const countConfidence = Math.min(0.97, Math.max(0.62, 0.78 + jitter));
  const instances: TrayPlantDetectionBox[] = [];
  const n = Math.min(count, 32);
  for (let i = 0; i < n; i++) {
    const seed = digest[(i + 2) % digest.length];
    instances.push({
      x: ((seed + i * 17) % 78) / 100,
      y: ((seed * 3 + i * 11) % 68) / 100,
      w: 0.07 + (digest[(i + 3) % 32] % 45) / 500,
      h: 0.09 + (digest[(i + 5) % 32] % 55) / 500,
      score: Math.min(
        0.97,
        0.52 + (digest[(i + 7) % 32] / 255) * 0.42
      )
    });
  }
  return {
    count,
    countConfidence: Math.round(countConfidence * 1000) / 1000,
    instances,
    source: "simulated"
  };
}

async function remoteTrayVision(
  imageBytes: Buffer
): Promise<TrayPlantVisionResult | null> {
  const url = env.cv.trayInferenceUrl.trim();
  if (!url) {
    return null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (env.cv.trayInferenceApiKey) {
    headers.Authorization = `Bearer ${env.cv.trayInferenceApiKey}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64: imageBytes.toString("base64")
      }),
      signal: AbortSignal.timeout(60_000)
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as RemotePayload;
    const count = Number(body.count);
    const confRaw = body.countConfidence ?? body.confidence;
    const countConfidence = Number(confRaw);
    if (!Number.isFinite(count) || count < 0 || !Number.isFinite(countConfidence)) {
      return null;
    }
    return {
      count: Math.round(count),
      countConfidence: Math.min(1, Math.max(0, countConfidence)),
      instances: parseBoxes(body.instances),
      source: "remote"
    };
  } catch {
    return null;
  }
}

export async function analyzeTrayImageForPlantInstances(
  imageBytes: Buffer
): Promise<TrayPlantVisionResult> {
  const remote = await remoteTrayVision(imageBytes);
  if (remote) {
    return remote;
  }
  return simulatedTrayVision(imageBytes);
}

export async function persistTrayVisionResult(
  trayId: string,
  result: TrayPlantVisionResult
): Promise<void> {
  const at = new Date().toISOString();
  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE tray_systems SET
      vision_plant_count = $1,
      vision_plant_count_at = $2,
      vision_plant_count_confidence = $3,
      vision_detections_json = $4::json
     WHERE id = $5`,
    [
      result.count,
      at,
      result.countConfidence,
      JSON.stringify(result.instances),
      trayId
    ]
  );
}
