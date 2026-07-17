import { requirePostgresPool, queryRows } from "@/lib/db/postgres";
import {
  generateDeviceApiKey,
  hashDeviceApiKey,
  mapEdgeDeviceRow,
  type AuthenticatedEdgeDevice,
  type EdgeDeviceStatus
} from "@/lib/auth/device-auth";
import { createTraySystem } from "@/lib/services/topology-service";
import type { TraySystem } from "@/lib/types/domain";
import { env } from "@/lib/config/env";

interface EdgeDeviceRow {
  id: string;
  owner_email: string;
  cpu_serial: string;
  mac_address: string | null;
  hostname: string | null;
  model: string | null;
  moonraker_url: string | null;
  api_key_prefix: string;
  status: string;
  last_heartbeat_at: Date | string | null;
  hinge_min_deg: string | number | null;
  hinge_max_deg: string | number | null;
  motor_min_mm: string | number | null;
  motor_max_mm: string | number | null;
  revoked_at: Date | string | null;
}

export interface RegisterEdgeDeviceInput {
  cpuSerial: string;
  macAddress?: string;
  hostname?: string;
  model?: string;
  moonrakerUrl?: string;
  provisioningCode: string;
  ownerEmail?: string;
  trayName?: string;
  zone?: string;
  crop?: string;
  /** When true and serial already exists, rotate key and refresh metadata. */
  reProvision?: boolean;
}

export interface RegisterEdgeDeviceResult {
  device: AuthenticatedEdgeDevice;
  tray: TraySystem;
  apiKey: string;
  reProvisioned: boolean;
}

function assertProvisioningCode(code: string) {
  const expected = env.device.provisioningSecret;
  if (!expected) {
    throw new Error(
      "DEVICE_PROVISIONING_SECRET is not configured on the server"
    );
  }
  if (code.trim() !== expected) {
    const err = new Error("Invalid provisioning code");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

export async function getEdgeDeviceById(
  deviceId: string
): Promise<AuthenticatedEdgeDevice | null> {
  const rows = await queryRows<EdgeDeviceRow>(
    `SELECT id, owner_email, cpu_serial, mac_address, hostname, model,
            moonraker_url, api_key_prefix, status, last_heartbeat_at,
            hinge_min_deg, hinge_max_deg, motor_min_mm, motor_max_mm, revoked_at
     FROM edge_devices
     WHERE id = $1
     LIMIT 1`,
    [deviceId]
  );
  return rows[0] ? mapEdgeDeviceRow(rows[0]) : null;
}

export async function listEdgeDevicesForOwner(
  ownerEmail: string
): Promise<AuthenticatedEdgeDevice[]> {
  const rows = await queryRows<EdgeDeviceRow>(
    `SELECT id, owner_email, cpu_serial, mac_address, hostname, model,
            moonraker_url, api_key_prefix, status, last_heartbeat_at,
            hinge_min_deg, hinge_max_deg, motor_min_mm, motor_max_mm, revoked_at
     FROM edge_devices
     WHERE owner_email = $1
     ORDER BY created_at DESC`,
    [ownerEmail.toLowerCase()]
  );
  return rows.map(mapEdgeDeviceRow);
}

export async function getEdgeDeviceForTray(
  ownerEmail: string,
  trayId: string
): Promise<AuthenticatedEdgeDevice | null> {
  const rows = await queryRows<EdgeDeviceRow>(
    `SELECT d.id, d.owner_email, d.cpu_serial, d.mac_address, d.hostname, d.model,
            d.moonraker_url, d.api_key_prefix, d.status, d.last_heartbeat_at,
            d.hinge_min_deg, d.hinge_max_deg, d.motor_min_mm, d.motor_max_mm,
            d.revoked_at
     FROM edge_devices d
     INNER JOIN tray_systems t ON t.edge_device_id = d.id
     WHERE t.id = $1 AND t.owner_email = $2
     LIMIT 1`,
    [trayId, ownerEmail.toLowerCase()]
  );
  return rows[0] ? mapEdgeDeviceRow(rows[0]) : null;
}

export async function registerEdgeDevice(
  input: RegisterEdgeDeviceInput
): Promise<RegisterEdgeDeviceResult> {
  assertProvisioningCode(input.provisioningCode);

  const cpuSerial = input.cpuSerial.trim();
  if (!cpuSerial) {
    throw new Error("cpuSerial is required");
  }

  const ownerEmail = (
    input.ownerEmail?.trim() ||
    env.device.defaultOwnerEmail ||
    ""
  ).toLowerCase();
  if (!ownerEmail) {
    throw new Error(
      "ownerEmail is required when DEVICE_DEFAULT_OWNER_EMAIL is unset"
    );
  }

  const pool = requirePostgresPool();
  const existing = await queryRows<{ id: string; revoked_at: Date | string | null }>(
    `SELECT id, revoked_at FROM edge_devices WHERE cpu_serial = $1 LIMIT 1`,
    [cpuSerial]
  );

  if (existing[0] && !input.reProvision) {
    const err = new Error(
      "Device serial already registered. Set reProvision=true with a valid provisioning code to rotate credentials."
    );
    (err as Error & { status: number }).status = 409;
    throw err;
  }

  const key = generateDeviceApiKey();
  const now = new Date().toISOString();
  let deviceId: string;
  let reProvisioned = false;

  if (existing[0] && input.reProvision) {
    deviceId = existing[0].id;
    reProvisioned = true;
    await pool.query(
      `UPDATE edge_devices
       SET owner_email = $1,
           mac_address = $2,
           hostname = $3,
           model = $4,
           moonraker_url = COALESCE($5, moonraker_url),
           api_key_hash = $6,
           api_key_prefix = $7,
           status = 'offline',
           revoked_at = NULL,
           updated_at = $8
       WHERE id = $9`,
      [
        ownerEmail,
        input.macAddress?.trim() || null,
        input.hostname?.trim() || null,
        input.model?.trim() || null,
        input.moonrakerUrl?.trim() || null,
        key.hash,
        key.prefix,
        now,
        deviceId
      ]
    );
  } else {
    deviceId = `edge-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await pool.query(
      `INSERT INTO edge_devices
        (id, owner_email, cpu_serial, mac_address, hostname, model, moonraker_url,
         api_key_hash, api_key_prefix, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'offline',$10,$10)`,
      [
        deviceId,
        ownerEmail,
        cpuSerial,
        input.macAddress?.trim() || null,
        input.hostname?.trim() || null,
        input.model?.trim() || null,
        input.moonrakerUrl?.trim() || null,
        key.hash,
        key.prefix,
        now
      ]
    );
  }

  const linked = await queryRows<{ id: string }>(
    `SELECT id FROM tray_systems
     WHERE edge_device_id = $1 AND owner_email = $2
     LIMIT 1`,
    [deviceId, ownerEmail]
  );

  let tray: TraySystem;
  if (linked[0]) {
    const { getTrayById } = await import("@/lib/services/topology-service");
    const existingTray = await getTrayById(ownerEmail, linked[0].id);
    if (!existingTray) throw new Error("Linked tray missing");
    tray = existingTray;
  } else {
    const hostnameLabel = input.hostname?.trim() || cpuSerial.slice(0, 8);
    tray = await createTraySystem({
      ownerEmail,
      name: input.trayName?.trim() || `Pi Tray (${hostnameLabel})`,
      zone: input.zone?.trim() || "Bench",
      crop: input.crop?.trim() || "Mixed",
      deviceId
    });
    await pool.query(
      `UPDATE tray_systems
       SET edge_device_id = $1, device_id = $2
       WHERE id = $3 AND owner_email = $4`,
      [deviceId, deviceId, tray.id, ownerEmail]
    );
    const { getTrayById } = await import("@/lib/services/topology-service");
    const refreshed = await getTrayById(ownerEmail, tray.id);
    if (refreshed) tray = refreshed;
  }

  const device = await getEdgeDeviceById(deviceId);
  if (!device) throw new Error("Device registration failed");

  return {
    device,
    tray,
    apiKey: key.plaintext,
    reProvisioned
  };
}

export async function linkDeviceToTray(input: {
  ownerEmail: string;
  deviceId: string;
  trayId: string;
}): Promise<TraySystem | null> {
  const device = await getEdgeDeviceById(input.deviceId);
  if (!device || device.ownerEmail !== input.ownerEmail.toLowerCase()) {
    return null;
  }
  const { getTrayById } = await import("@/lib/services/topology-service");
  const tray = await getTrayById(input.ownerEmail, input.trayId);
  if (!tray) return null;

  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE tray_systems
     SET edge_device_id = $1, device_id = $2
     WHERE id = $3 AND owner_email = $4`,
    [input.deviceId, input.deviceId, input.trayId, input.ownerEmail.toLowerCase()]
  );
  return getTrayById(input.ownerEmail, input.trayId);
}

export async function revokeEdgeDevice(
  ownerEmail: string,
  deviceId: string
): Promise<AuthenticatedEdgeDevice | null> {
  const pool = requirePostgresPool();
  const result = await pool.query(
    `UPDATE edge_devices
     SET revoked_at = NOW(), status = 'offline', updated_at = NOW(),
         api_key_hash = $1
     WHERE id = $2 AND owner_email = $3 AND revoked_at IS NULL
     RETURNING id`,
    [hashDeviceApiKey(`revoked-${Date.now()}`), deviceId, ownerEmail.toLowerCase()]
  );
  if (!result.rowCount) return null;
  return getEdgeDeviceById(deviceId);
}

export async function rotateEdgeDeviceKey(
  ownerEmail: string,
  deviceId: string
): Promise<{ device: AuthenticatedEdgeDevice; apiKey: string } | null> {
  const device = await getEdgeDeviceById(deviceId);
  if (!device || device.ownerEmail !== ownerEmail.toLowerCase()) {
    return null;
  }
  const key = generateDeviceApiKey();
  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE edge_devices
     SET api_key_hash = $1, api_key_prefix = $2, revoked_at = NULL,
         updated_at = NOW()
     WHERE id = $3`,
    [key.hash, key.prefix, deviceId]
  );
  const updated = await getEdgeDeviceById(deviceId);
  if (!updated) return null;
  return { device: updated, apiKey: key.plaintext };
}

export async function updateDeviceHeartbeat(input: {
  deviceId: string;
  status?: EdgeDeviceStatus;
  hingeMinDeg?: number;
  hingeMaxDeg?: number;
  motorMinMm?: number;
  motorMaxMm?: number;
  moonrakerUrl?: string;
}): Promise<AuthenticatedEdgeDevice | null> {
  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE edge_devices
     SET last_heartbeat_at = NOW(),
         status = COALESCE($2, 'online'),
         hinge_min_deg = COALESCE($3, hinge_min_deg),
         hinge_max_deg = COALESCE($4, hinge_max_deg),
         motor_min_mm = COALESCE($5, motor_min_mm),
         motor_max_mm = COALESCE($6, motor_max_mm),
         moonraker_url = COALESCE($7, moonraker_url),
         updated_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [
      input.deviceId,
      input.status ?? "online",
      input.hingeMinDeg ?? null,
      input.hingeMaxDeg ?? null,
      input.motorMinMm ?? null,
      input.motorMaxMm ?? null,
      input.moonrakerUrl?.trim() || null
    ]
  );
  return getEdgeDeviceById(input.deviceId);
}

/** Mark devices with stale heartbeats as offline (for dashboards / future alerts). */
export async function markStaleDevicesOffline(
  staleMinutes = env.device.heartbeatStaleMinutes
): Promise<number> {
  const pool = requirePostgresPool();
  const result = await pool.query(
    `UPDATE edge_devices
     SET status = 'offline', updated_at = NOW()
     WHERE revoked_at IS NULL
       AND status = 'online'
       AND (
         last_heartbeat_at IS NULL
         OR last_heartbeat_at < NOW() - ($1::text || ' minutes')::interval
       )`,
    [String(staleMinutes)]
  );
  return result.rowCount ?? 0;
}
