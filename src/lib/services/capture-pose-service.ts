import { requirePostgresPool, queryRows } from "@/lib/db/postgres";

export interface CapturePose {
  id: string;
  sequenceId: string;
  poseOrder: number;
  slotLabel: string;
  row: number;
  column: number;
  plantId: string | null;
  hingeDeg: number;
  motorMm: number;
  dwellMs: number;
}

export interface CapturePoseSequence {
  id: string;
  ownerEmail: string;
  trayId: string;
  deviceId: string | null;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  poses: CapturePose[];
}

interface SequenceRow {
  id: string;
  owner_email: string;
  tray_id: string;
  device_id: string | null;
  name: string;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PoseRow {
  id: string;
  sequence_id: string;
  pose_order: number;
  slot_label: string;
  row_index: number;
  column_index: number;
  plant_id: string | null;
  hinge_deg: string | number;
  motor_mm: string | number;
  dwell_ms: number;
}

const mapPose = (row: PoseRow): CapturePose => ({
  id: row.id,
  sequenceId: row.sequence_id,
  poseOrder: Number(row.pose_order),
  slotLabel: row.slot_label,
  row: Number(row.row_index),
  column: Number(row.column_index),
  plantId: row.plant_id,
  hingeDeg: Number(row.hinge_deg),
  motorMm: Number(row.motor_mm),
  dwellMs: Number(row.dwell_ms)
});

async function loadPoses(sequenceId: string): Promise<CapturePose[]> {
  const rows = await queryRows<PoseRow>(
    `SELECT * FROM capture_poses
     WHERE sequence_id = $1
     ORDER BY pose_order ASC`,
    [sequenceId]
  );
  return rows.map(mapPose);
}

async function mapSequence(row: SequenceRow): Promise<CapturePoseSequence> {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    trayId: row.tray_id,
    deviceId: row.device_id,
    name: row.name,
    active: Boolean(row.active),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    poses: await loadPoses(row.id)
  };
}

export async function listPoseSequencesForTray(
  ownerEmail: string,
  trayId: string
): Promise<CapturePoseSequence[]> {
  const rows = await queryRows<SequenceRow>(
    `SELECT * FROM capture_pose_sequences
     WHERE owner_email = $1 AND tray_id = $2
     ORDER BY updated_at DESC`,
    [ownerEmail.toLowerCase(), trayId]
  );
  return Promise.all(rows.map(mapSequence));
}

export async function getActivePoseSequenceForDevice(
  deviceId: string
): Promise<CapturePoseSequence | null> {
  const rows = await queryRows<SequenceRow>(
    `SELECT s.*
     FROM capture_pose_sequences s
     INNER JOIN tray_systems t ON t.id = s.tray_id
     WHERE s.active = TRUE
       AND (s.device_id = $1 OR t.edge_device_id = $1)
     ORDER BY s.updated_at DESC
     LIMIT 1`,
    [deviceId]
  );
  return rows[0] ? mapSequence(rows[0]) : null;
}

export async function upsertPoseSequence(input: {
  ownerEmail: string;
  trayId: string;
  deviceId?: string | null;
  name: string;
  active?: boolean;
  sequenceId?: string;
  poses: Array<{
    poseOrder: number;
    slotLabel?: string;
    row?: number;
    column?: number;
    plantId?: string | null;
    hingeDeg: number;
    motorMm: number;
    dwellMs?: number;
  }>;
}): Promise<CapturePoseSequence> {
  const pool = requirePostgresPool();
  const owner = input.ownerEmail.toLowerCase();
  const id =
    input.sequenceId ??
    `poseseq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  if (input.active !== false) {
    await pool.query(
      `UPDATE capture_pose_sequences
       SET active = FALSE, updated_at = NOW()
       WHERE tray_id = $1 AND owner_email = $2 AND id <> $3`,
      [input.trayId, owner, id]
    );
  }

  await pool.query(
    `INSERT INTO capture_pose_sequences
      (id, owner_email, tray_id, device_id, name, active)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       device_id = EXCLUDED.device_id,
       active = EXCLUDED.active,
       updated_at = NOW()`,
    [
      id,
      owner,
      input.trayId,
      input.deviceId ?? null,
      input.name.trim() || "Capture poses",
      input.active !== false
    ]
  );

  await pool.query(`DELETE FROM capture_poses WHERE sequence_id = $1`, [id]);

  for (const pose of input.poses) {
    const poseId = `pose-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
      `INSERT INTO capture_poses
        (id, sequence_id, pose_order, slot_label, row_index, column_index,
         plant_id, hinge_deg, motor_mm, dwell_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        poseId,
        id,
        pose.poseOrder,
        pose.slotLabel ?? "",
        pose.row ?? 0,
        pose.column ?? 0,
        pose.plantId ?? null,
        pose.hingeDeg,
        pose.motorMm,
        pose.dwellMs ?? 500
      ]
    );
  }

  const rows = await queryRows<SequenceRow>(
    `SELECT * FROM capture_pose_sequences WHERE id = $1`,
    [id]
  );
  return mapSequence(rows[0]!);
}

/** Generate one pose per plant in the tray grid (default hinge/motor = 0). */
export async function generatePosesFromPlantLayout(input: {
  ownerEmail: string;
  trayId: string;
  deviceId?: string | null;
  name?: string;
  hingeDeg?: number;
  motorMm?: number;
  dwellMs?: number;
}): Promise<CapturePoseSequence> {
  const plants = await queryRows<{
    id: string;
    slot_label: string;
    row_index: number;
    column_index: number;
  }>(
    `SELECT id, slot_label, row_index, column_index
     FROM plants
     WHERE tray_id = $1 AND owner_email = $2
     ORDER BY row_index ASC, column_index ASC, slot_label ASC`,
    [input.trayId, input.ownerEmail.toLowerCase()]
  );

  const poses = plants.map((p, i) => ({
    poseOrder: i + 1,
    slotLabel: p.slot_label,
    row: Number(p.row_index),
    column: Number(p.column_index),
    plantId: p.id,
    hingeDeg: input.hingeDeg ?? 0,
    motorMm: input.motorMm ?? 0,
    dwellMs: input.dwellMs ?? 800
  }));

  return upsertPoseSequence({
    ownerEmail: input.ownerEmail,
    trayId: input.trayId,
    deviceId: input.deviceId,
    name: input.name ?? "Generated from plant layout",
    active: true,
    poses
  });
}

export async function updateDeviceActuatorLimits(input: {
  ownerEmail: string;
  deviceId: string;
  hingeMinDeg?: number | null;
  hingeMaxDeg?: number | null;
  motorMinMm?: number | null;
  motorMaxMm?: number | null;
}): Promise<boolean> {
  const pool = requirePostgresPool();
  const result = await pool.query(
    `UPDATE edge_devices
     SET hinge_min_deg = COALESCE($3, hinge_min_deg),
         hinge_max_deg = COALESCE($4, hinge_max_deg),
         motor_min_mm = COALESCE($5, motor_min_mm),
         motor_max_mm = COALESCE($6, motor_max_mm),
         updated_at = NOW()
     WHERE id = $1 AND owner_email = $2 AND revoked_at IS NULL`,
    [
      input.deviceId,
      input.ownerEmail.toLowerCase(),
      input.hingeMinDeg ?? null,
      input.hingeMaxDeg ?? null,
      input.motorMinMm ?? null,
      input.motorMaxMm ?? null
    ]
  );
  return (result.rowCount ?? 0) > 0;
}
