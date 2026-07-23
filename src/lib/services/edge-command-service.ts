import { requirePostgresPool, queryRows } from "@/lib/db/postgres";

export type EdgeCommandType = "capture_now" | "sync_poses" | "reboot_agent";
export type EdgeCommandStatus =
  | "pending"
  | "claimed"
  | "completed"
  | "failed"
  | "cancelled";

export interface EdgeDeviceCommand {
  id: string;
  deviceId: string;
  trayId: string | null;
  plantId: string | null;
  commandType: EdgeCommandType | string;
  payload: Record<string, unknown>;
  status: EdgeCommandStatus;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
}

interface CommandRow {
  id: string;
  device_id: string;
  tray_id: string | null;
  plant_id: string | null;
  command_type: string;
  payload_json: Record<string, unknown> | string;
  status: string;
  result_json: Record<string, unknown> | string | null;
  error_message: string | null;
  created_at: Date | string;
  claimed_at: Date | string | null;
  completed_at: Date | string | null;
}

const parseJson = <T,>(raw: T | string | null): T | null => {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw;
};

const mapCommand = (row: CommandRow): EdgeDeviceCommand => ({
  id: row.id,
  deviceId: row.device_id,
  trayId: row.tray_id,
  plantId: row.plant_id,
  commandType: row.command_type,
  payload: parseJson<Record<string, unknown>>(row.payload_json) ?? {},
  status: row.status as EdgeCommandStatus,
  result: parseJson<Record<string, unknown>>(row.result_json),
  errorMessage: row.error_message,
  createdAt: new Date(row.created_at).toISOString(),
  claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
  completedAt: row.completed_at
    ? new Date(row.completed_at).toISOString()
    : null
});

export async function enqueueEdgeCommand(input: {
  deviceId: string;
  trayId?: string;
  plantId?: string;
  commandType: EdgeCommandType | string;
  payload?: Record<string, unknown>;
}): Promise<EdgeDeviceCommand> {
  const pool = requirePostgresPool();
  const id = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await pool.query(
    `INSERT INTO edge_device_commands
      (id, device_id, tray_id, plant_id, command_type, payload_json, status)
     VALUES ($1,$2,$3,$4,$5,$6::json,'pending')`,
    [
      id,
      input.deviceId,
      input.trayId ?? null,
      input.plantId ?? null,
      input.commandType,
      JSON.stringify(input.payload ?? {})
    ]
  );
  const rows = await queryRows<CommandRow>(
    `SELECT * FROM edge_device_commands WHERE id = $1`,
    [id]
  );
  return mapCommand(rows[0]!);
}

export async function listPendingCommandsForDevice(
  deviceId: string,
  limit = 5
): Promise<EdgeDeviceCommand[]> {
  const rows = await queryRows<CommandRow>(
    `SELECT * FROM edge_device_commands
     WHERE device_id = $1 AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT $2`,
    [deviceId, limit]
  );
  return rows.map(mapCommand);
}

export async function claimEdgeCommand(
  commandId: string,
  deviceId: string
): Promise<EdgeDeviceCommand | null> {
  const pool = requirePostgresPool();
  const result = await pool.query(
    `UPDATE edge_device_commands
     SET status = 'claimed', claimed_at = NOW()
     WHERE id = $1 AND device_id = $2 AND status = 'pending'
     RETURNING id`,
    [commandId, deviceId]
  );
  if (!result.rowCount) return null;
  const rows = await queryRows<CommandRow>(
    `SELECT * FROM edge_device_commands WHERE id = $1`,
    [commandId]
  );
  return rows[0] ? mapCommand(rows[0]) : null;
}

export async function completeEdgeCommand(input: {
  commandId: string;
  deviceId: string;
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  errorMessage?: string;
}): Promise<EdgeDeviceCommand | null> {
  const pool = requirePostgresPool();
  const result = await pool.query(
    `UPDATE edge_device_commands
     SET status = $3,
         result_json = COALESCE($4::json, result_json),
         error_message = $5,
         completed_at = NOW()
     WHERE id = $1 AND device_id = $2
       AND status IN ('pending', 'claimed')
     RETURNING id`,
    [
      input.commandId,
      input.deviceId,
      input.status,
      input.result ? JSON.stringify(input.result) : null,
      input.errorMessage ?? null
    ]
  );
  if (!result.rowCount) return null;
  const rows = await queryRows<CommandRow>(
    `SELECT * FROM edge_device_commands WHERE id = $1`,
    [input.commandId]
  );
  return rows[0] ? mapCommand(rows[0]) : null;
}

export async function getEdgeCommandForOwner(
  ownerEmail: string,
  commandId: string
): Promise<EdgeDeviceCommand | null> {
  const rows = await queryRows<CommandRow>(
    `SELECT c.*
     FROM edge_device_commands c
     INNER JOIN edge_devices d ON d.id = c.device_id
     WHERE c.id = $1 AND d.owner_email = $2
     LIMIT 1`,
    [commandId, ownerEmail.toLowerCase()]
  );
  return rows[0] ? mapCommand(rows[0]) : null;
}
