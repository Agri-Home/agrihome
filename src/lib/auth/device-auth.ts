import { createHash, randomBytes, timingSafeEqual } from "crypto";

import { queryRows } from "@/lib/db/postgres";

export const DEVICE_API_KEY_HEADER = "x-agrihome-device-key";

export type EdgeDeviceStatus = "online" | "offline" | "error";

export interface AuthenticatedEdgeDevice {
  id: string;
  ownerEmail: string;
  cpuSerial: string;
  macAddress: string | null;
  hostname: string | null;
  model: string | null;
  moonrakerUrl: string | null;
  status: EdgeDeviceStatus;
  lastHeartbeatAt: string | null;
  hingeMinDeg: number | null;
  hingeMaxDeg: number | null;
  motorMinMm: number | null;
  motorMaxMm: number | null;
  apiKeyPrefix: string;
  revokedAt: string | null;
}

interface EdgeDeviceRow {
  id: string;
  owner_email: string;
  cpu_serial: string;
  mac_address: string | null;
  hostname: string | null;
  model: string | null;
  moonraker_url: string | null;
  api_key_hash: string;
  api_key_prefix: string;
  status: string;
  last_heartbeat_at: Date | string | null;
  hinge_min_deg: string | number | null;
  hinge_max_deg: string | number | null;
  motor_min_mm: string | number | null;
  motor_max_mm: string | number | null;
  revoked_at: Date | string | null;
}

const toNum = (v: string | number | null): number | null =>
  v == null ? null : Number(v);

export const mapEdgeDeviceRow = (
  row: Omit<EdgeDeviceRow, "api_key_hash"> & { api_key_hash?: string }
): AuthenticatedEdgeDevice => ({
  id: row.id,
  ownerEmail: row.owner_email,
  cpuSerial: row.cpu_serial,
  macAddress: row.mac_address,
  hostname: row.hostname,
  model: row.model,
  moonrakerUrl: row.moonraker_url,
  status: (row.status as EdgeDeviceStatus) || "offline",
  lastHeartbeatAt: row.last_heartbeat_at
    ? new Date(row.last_heartbeat_at).toISOString()
    : null,
  hingeMinDeg: toNum(row.hinge_min_deg),
  hingeMaxDeg: toNum(row.hinge_max_deg),
  motorMinMm: toNum(row.motor_min_mm),
  motorMaxMm: toNum(row.motor_max_mm),
  apiKeyPrefix: row.api_key_prefix,
  revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null
});

export function hashDeviceApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

export function generateDeviceApiKey(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const plaintext = `ahdev_${randomBytes(24).toString("base64url")}`;
  return {
    plaintext,
    hash: hashDeviceApiKey(plaintext),
    prefix: plaintext.slice(0, 12)
  };
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export async function findDeviceByApiKey(
  plaintext: string
): Promise<AuthenticatedEdgeDevice | null> {
  const hash = hashDeviceApiKey(plaintext);
  const rows = await queryRows<EdgeDeviceRow>(
    `SELECT id, owner_email, cpu_serial, mac_address, hostname, model,
            moonraker_url, api_key_hash, api_key_prefix, status,
            last_heartbeat_at, hinge_min_deg, hinge_max_deg,
            motor_min_mm, motor_max_mm, revoked_at
     FROM edge_devices
     WHERE api_key_hash = $1
     LIMIT 1`,
    [hash]
  );
  const row = rows[0];
  if (!row || row.revoked_at) {
    return null;
  }
  if (!safeEqualHex(row.api_key_hash, hash)) {
    return null;
  }
  return mapEdgeDeviceRow(row);
}

export async function requireDeviceApiKey(
  request: Request
): Promise<AuthenticatedEdgeDevice | Response> {
  const key = request.headers.get(DEVICE_API_KEY_HEADER)?.trim();
  if (!key) {
    return new Response(
      JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: `Missing ${DEVICE_API_KEY_HEADER} header`
        }
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const device = await findDeviceByApiKey(key);
  if (!device) {
    return new Response(
      JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or revoked device API key"
        }
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return device;
}
