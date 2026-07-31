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

/**
 * Drop poses whose plant_id no longer exists on the tray (deleted plants).
 * Re-numbers pose_order. Persists when anything was removed.
 */
export async function pruneDeletedPlantPoses(
  sequence: CapturePoseSequence
): Promise<CapturePoseSequence> {
  const live = await queryRows<{ id: string }>(
    `SELECT id FROM plants WHERE tray_id = $1 AND owner_email = $2`,
    [sequence.trayId, sequence.ownerEmail.toLowerCase()]
  );
  const liveIds = new Set(live.map((p) => p.id));
  const kept = sequence.poses.filter(
    (p) => !p.plantId || liveIds.has(p.plantId)
  );
  if (kept.length === sequence.poses.length) {
    return sequence;
  }
  return upsertPoseSequence({
    ownerEmail: sequence.ownerEmail,
    trayId: sequence.trayId,
    deviceId: sequence.deviceId,
    name: sequence.name,
    sequenceId: sequence.id,
    active: sequence.active,
    poses: kept.map((p, i) => ({
      poseOrder: i + 1,
      slotLabel: p.slotLabel,
      row: p.row,
      column: p.column,
      plantId: p.plantId,
      hingeDeg: p.hingeDeg,
      motorMm: p.motorMm,
      dwellMs: p.dwellMs
    }))
  });
}

/** Remove all pose rows for a plant (call when the plant is deleted). */
export async function removePlantFromAllPoseSequences(
  plantId: string
): Promise<void> {
  const pool = requirePostgresPool();
  await pool.query(`DELETE FROM capture_poses WHERE plant_id = $1`, [plantId]);
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
  const sequences = await Promise.all(rows.map(mapSequence));
  return Promise.all(sequences.map((s) => pruneDeletedPlantPoses(s)));
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
  if (!rows[0]) return null;
  const sequence = await mapSequence(rows[0]);
  return pruneDeletedPlantPoses(sequence);
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

/**
 * Generate one pose per plant in the tray grid.
 * Reuses hinge/motor from the active sequence or latest stamped capture when
 * known so "Generate" / auto-scan does not wipe taught positions.
 */
export async function generatePosesFromPlantLayout(input: {
  ownerEmail: string;
  trayId: string;
  deviceId?: string | null;
  name?: string;
  hingeDeg?: number;
  motorMm?: number;
  dwellMs?: number;
}): Promise<CapturePoseSequence> {
  const owner = input.ownerEmail.toLowerCase();
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
    [input.trayId, owner]
  );

  const sequences = await listPoseSequencesForTray(owner, input.trayId);
  const active = sequences.find((s) => s.active) ?? sequences[0] ?? null;
  const plantSequence =
    sequences.find((sequence) =>
      sequence.poses.some((pose) => Boolean(pose.plantId))
    ) ?? null;
  const knownByPlant = new Map(
    (plantSequence?.poses ?? [])
      .filter((p) => p.plantId)
      .map((p) => [p.plantId as string, p])
  );

  const capturePoses = await queryRows<{
    plant_id: string;
    hinge_deg: string | number | null;
    motor_mm: string | number | null;
  }>(
    `SELECT DISTINCT ON (plant_id)
        plant_id, hinge_deg, motor_mm
     FROM camera_captures
     WHERE tray_id = $1
       AND plant_id IS NOT NULL
       AND hinge_deg IS NOT NULL
       AND motor_mm IS NOT NULL
     ORDER BY plant_id, captured_at DESC`,
    [input.trayId]
  );
  const captureByPlant = new Map(
    capturePoses.map((r) => [
      r.plant_id,
      {
        hingeDeg: Number(r.hinge_deg),
        motorMm: Number(r.motor_mm)
      }
    ])
  );

  const poses = plants.map((p, i) => {
    const known = knownByPlant.get(p.id);
    const fromCapture = captureByPlant.get(p.id);
    const hinge =
      input.hingeDeg ??
      known?.hingeDeg ??
      (fromCapture && Number.isFinite(fromCapture.hingeDeg)
        ? fromCapture.hingeDeg
        : 0);
    const motor =
      input.motorMm ??
      known?.motorMm ??
      (fromCapture && Number.isFinite(fromCapture.motorMm)
        ? fromCapture.motorMm
        : 0);
    return {
      poseOrder: i + 1,
      slotLabel: p.slot_label,
      row: Number(p.row_index),
      column: Number(p.column_index),
      plantId: p.id,
      hingeDeg: hinge,
      motorMm: motor,
      dwellMs: input.dwellMs ?? known?.dwellMs ?? 2000
    };
  });

  return upsertPoseSequence({
    ownerEmail: owner,
    trayId: input.trayId,
    deviceId: input.deviceId ?? plantSequence?.deviceId ?? active?.deviceId,
    name: input.name ?? plantSequence?.name ?? "Generated from plant layout",
    sequenceId: plantSequence?.id,
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

/**
 * Upsert hinge/motor for a plant on the tray's active pose sequence.
 * Creates an active sequence when none exists. Updates an existing pose
 * for the plant, or appends a new pose when the plant is new.
 */
export async function upsertPlantPosePosition(input: {
  ownerEmail: string;
  trayId: string;
  plantId: string;
  hingeDeg: number;
  motorMm: number;
  deviceId?: string | null;
  dwellMs?: number;
}): Promise<CapturePoseSequence> {
  const owner = input.ownerEmail.toLowerCase();
  const plantRows = await queryRows<{
    id: string;
    slot_label: string;
    row_index: number;
    column_index: number;
  }>(
    `SELECT id, slot_label, row_index, column_index
     FROM plants
     WHERE id = $1 AND tray_id = $2 AND owner_email = $3
     LIMIT 1`,
    [input.plantId, input.trayId, owner]
  );
  const plant = plantRows[0];
  if (!plant) {
    throw new Error("Plant not found on this tray");
  }

  const sequences = await listPoseSequencesForTray(owner, input.trayId);
  const active = sequences.find((s) => s.active) ?? sequences[0] ?? null;

  const nextPose = {
    poseOrder: 1,
    slotLabel: plant.slot_label || "",
    row: Number(plant.row_index),
    column: Number(plant.column_index),
    plantId: plant.id,
    hingeDeg: input.hingeDeg,
    motorMm: input.motorMm,
    dwellMs: input.dwellMs ?? 800
  };

  if (!active) {
    return upsertPoseSequence({
      ownerEmail: owner,
      trayId: input.trayId,
      deviceId: input.deviceId,
      name: "Plant capture poses",
      active: true,
      poses: [nextPose]
    });
  }

  const existingIdx = active.poses.findIndex((p) => p.plantId === plant.id);
  const poses =
    existingIdx >= 0
      ? active.poses.map((p, i) =>
          i === existingIdx
            ? {
                poseOrder: p.poseOrder,
                slotLabel: p.slotLabel || nextPose.slotLabel,
                row: p.row,
                column: p.column,
                plantId: plant.id,
                hingeDeg: input.hingeDeg,
                motorMm: input.motorMm,
                dwellMs: p.dwellMs
              }
            : {
                poseOrder: p.poseOrder,
                slotLabel: p.slotLabel,
                row: p.row,
                column: p.column,
                plantId: p.plantId,
                hingeDeg: p.hingeDeg,
                motorMm: p.motorMm,
                dwellMs: p.dwellMs
              }
        )
      : [
          ...active.poses.map((p) => ({
            poseOrder: p.poseOrder,
            slotLabel: p.slotLabel,
            row: p.row,
            column: p.column,
            plantId: p.plantId,
            hingeDeg: p.hingeDeg,
            motorMm: p.motorMm,
            dwellMs: p.dwellMs
          })),
          {
            ...nextPose,
            poseOrder:
              active.poses.reduce((max, p) => Math.max(max, p.poseOrder), 0) + 1
          }
        ];

  return upsertPoseSequence({
    ownerEmail: owner,
    trayId: input.trayId,
    deviceId: input.deviceId ?? active.deviceId,
    name: active.name,
    sequenceId: active.id,
    active: true,
    poses
  });
}
