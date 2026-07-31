import { requirePostgresPool } from "@/lib/db/postgres";
import { listPoseSequencesForTray } from "@/lib/services/capture-pose-service";
import { createManualPlant } from "@/lib/services/plant-manual-service";
import { getPlantById, listPlantsByTray } from "@/lib/services/plant-service";
import { getTrayById } from "@/lib/services/topology-service";
import type { PlantUnit } from "@/lib/types/domain";

export type EdgePlantAttachResult = {
  plant: PlantUnit;
  created: boolean;
};

/**
 * Same-position matching for edge captures:
 * Round hinge° and motor mm to 1° / 1 mm (Math.round) so bench noise
 * still maps to one plant. Label key: H{hinge}_M{motor} (e.g. H45_M120).
 */
export const POSE_MATCH_HINGE_STEP_DEG = 1;
export const POSE_MATCH_MOTOR_STEP_MM = 1;

export function roundPoseForMatch(
  hingeDeg: number,
  motorMm: number
): { hingeDeg: number; motorMm: number } {
  return {
    hingeDeg:
      Math.round(hingeDeg / POSE_MATCH_HINGE_STEP_DEG) *
      POSE_MATCH_HINGE_STEP_DEG,
    motorMm:
      Math.round(motorMm / POSE_MATCH_MOTOR_STEP_MM) *
      POSE_MATCH_MOTOR_STEP_MM
  };
}

export function poseSlotLabel(hingeDeg: number, motorMm: number): string {
  const rounded = roundPoseForMatch(hingeDeg, motorMm);
  return `H${rounded.hingeDeg}_M${rounded.motorMm}`;
}

function posesMatch(
  aHinge: number,
  aMotor: number,
  bHinge: number,
  bMotor: number
): boolean {
  const a = roundPoseForMatch(aHinge, aMotor);
  const b = roundPoseForMatch(bHinge, bMotor);
  return a.hingeDeg === b.hingeDeg && a.motorMm === b.motorMm;
}

async function findPlantBySlot(
  ownerEmail: string,
  trayId: string,
  slotLabel: string
): Promise<PlantUnit | null> {
  const label = slotLabel.trim();
  if (!label) return null;
  const pool = requirePostgresPool();
  const res = await pool.query<{ id: string }>(
    `SELECT id FROM plants
     WHERE owner_email = $1 AND tray_id = $2 AND slot_label = $3
     ORDER BY last_image_at DESC NULLS LAST, last_report_at DESC
     LIMIT 1`,
    [ownerEmail.toLowerCase(), trayId, label]
  );
  const id = res.rows[0]?.id;
  if (!id) return null;
  return getPlantById(ownerEmail, id);
}

/** Find a tray plant whose saved capture-pose matches rounded hinge/motor. */
async function findPlantByActuatorPose(input: {
  ownerEmail: string;
  trayId: string;
  hingeDeg: number;
  motorMm: number;
}): Promise<PlantUnit | null> {
  const ownerEmail = input.ownerEmail.toLowerCase();
  const sequences = await listPoseSequencesForTray(ownerEmail, input.trayId);
  // Prefer active sequence, then others (newest first from listPoseSequencesForTray).
  const ordered = [
    ...sequences.filter((s) => s.active),
    ...sequences.filter((s) => !s.active)
  ];
  for (const seq of ordered) {
    for (const pose of seq.poses) {
      if (!pose.plantId) continue;
      if (
        !posesMatch(
          pose.hingeDeg,
          pose.motorMm,
          input.hingeDeg,
          input.motorMm
        )
      ) {
        continue;
      }
      const plant = await getPlantById(ownerEmail, pose.plantId);
      if (plant && plant.trayId === input.trayId) {
        return plant;
      }
    }
  }

  // Fallback: plant created earlier with position slot label, or a prior
  // capture at this rounded pose (if pose upsert lagged).
  const slot = poseSlotLabel(input.hingeDeg, input.motorMm);
  const bySlot = await findPlantBySlot(ownerEmail, input.trayId, slot);
  if (bySlot) return bySlot;

  const rounded = roundPoseForMatch(input.hingeDeg, input.motorMm);
  const pool = requirePostgresPool();
  const fromCapture = await pool.query<{ plant_id: string }>(
    `SELECT plant_id
     FROM camera_captures
     WHERE tray_id = $1
       AND plant_id IS NOT NULL
       AND hinge_deg IS NOT NULL
       AND motor_mm IS NOT NULL
       AND ROUND(hinge_deg::numeric) = $2
       AND ROUND(motor_mm::numeric) = $3
     ORDER BY captured_at DESC
     LIMIT 1`,
    [input.trayId, rounded.hingeDeg, rounded.motorMm]
  );
  const capturePlantId = fromCapture.rows[0]?.plant_id;
  if (capturePlantId) {
    const plant = await getPlantById(ownerEmail, capturePlantId);
    if (plant && plant.trayId === input.trayId) return plant;
  }

  return null;
}

async function resolvePoseHint(input: {
  ownerEmail: string;
  trayId: string;
  poseOrder?: number;
}): Promise<{
  plantId?: string;
  slotLabel?: string;
  row?: number;
  column?: number;
}> {
  if (input.poseOrder == null || !Number.isFinite(input.poseOrder)) {
    return {};
  }
  const sequences = await listPoseSequencesForTray(
    input.ownerEmail,
    input.trayId
  );
  const active = sequences.find((s) => s.active) ?? sequences[0];
  if (!active) return {};
  const pose = active.poses.find(
    (p) => p.poseOrder === Math.round(input.poseOrder!)
  );
  if (!pose) return {};
  return {
    plantId: pose.plantId ?? undefined,
    slotLabel: pose.slotLabel?.trim() || undefined,
    row: pose.row > 0 && pose.column > 0 ? pose.row : undefined,
    column: pose.row > 0 && pose.column > 0 ? pose.column : undefined
  };
}

async function touchPlantLastImage(input: {
  ownerEmail: string;
  plantId: string;
  trayId: string;
  imageUrl: string;
  capturedAt: string;
}): Promise<void> {
  const pool = requirePostgresPool();
  await pool.query(
    `UPDATE plants
     SET last_image_url = $1, last_image_at = $2
     WHERE id = $3 AND tray_id = $4 AND owner_email = $5`,
    [
      input.imageUrl,
      input.capturedAt,
      input.plantId,
      input.trayId,
      input.ownerEmail.toLowerCase()
    ]
  );
}

async function attachExisting(
  ownerEmail: string,
  trayId: string,
  plant: PlantUnit,
  imageUrl: string,
  capturedAt: string
): Promise<EdgePlantAttachResult> {
  await touchPlantLastImage({
    ownerEmail,
    plantId: plant.id,
    trayId,
    imageUrl,
    capturedAt
  });
  const refreshed = await getPlantById(ownerEmail, plant.id);
  return { plant: refreshed ?? plant, created: false };
}

/**
 * Ensure a plant row exists on the tray for a Pi / Klipper capture.
 *
 * Priority:
 * 1. Explicit plantId (UI selection / command) — never overridden
 * 2. Actuator position (hinge/motor), rounded to 1° / 1 mm
 * 3. Pose-sequence plantId / slot from poseOrder
 * 4. Slot label match
 * 5. Create a new plant (position-labeled when hinge/motor known)
 */
export async function ensurePlantForEdgeCapture(input: {
  ownerEmail: string;
  trayId: string;
  imageUrl: string;
  capturedAt: string;
  plantId?: string;
  poseOrder?: number;
  slotLabel?: string;
  hingeDeg?: number | null;
  motorMm?: number | null;
}): Promise<EdgePlantAttachResult> {
  const ownerEmail = input.ownerEmail.toLowerCase();
  const tray = await getTrayById(ownerEmail, input.trayId);
  if (!tray) {
    throw new Error("Tray not found");
  }

  const hasPose =
    input.hingeDeg != null &&
    Number.isFinite(input.hingeDeg) &&
    input.motorMm != null &&
    Number.isFinite(input.motorMm);

  // 1. Explicit plantId from UI / agent command — honor as-is.
  const explicitPlantId = input.plantId?.trim() || undefined;
  if (explicitPlantId) {
    const existing = await getPlantById(ownerEmail, explicitPlantId);
    if (existing && existing.trayId === input.trayId) {
      return attachExisting(
        ownerEmail,
        input.trayId,
        existing,
        input.imageUrl,
        input.capturedAt
      );
    }
  }

  // 2. Same actuator position → same plant (photos accumulate for health trend).
  if (hasPose) {
    const byPose = await findPlantByActuatorPose({
      ownerEmail,
      trayId: input.trayId,
      hingeDeg: input.hingeDeg!,
      motorMm: input.motorMm!
    });
    if (byPose) {
      return attachExisting(
        ownerEmail,
        input.trayId,
        byPose,
        input.imageUrl,
        input.capturedAt
      );
    }
  }

  const poseHint = await resolvePoseHint({
    ownerEmail,
    trayId: input.trayId,
    poseOrder: input.poseOrder
  });

  // 3. Pose-walk plantId (when position was not available / unmatched).
  const hintPlantId = poseHint.plantId?.trim() || undefined;
  if (hintPlantId) {
    const existing = await getPlantById(ownerEmail, hintPlantId);
    if (existing && existing.trayId === input.trayId) {
      return attachExisting(
        ownerEmail,
        input.trayId,
        existing,
        input.imageUrl,
        input.capturedAt
      );
    }
  }

  const positionSlot = hasPose
    ? poseSlotLabel(input.hingeDeg!, input.motorMm!)
    : undefined;
  const slotLabel =
    input.slotLabel?.trim() ||
    positionSlot ||
    poseHint.slotLabel ||
    undefined;

  // 4. Slot label (includes H{h}_M{m} from a prior create).
  if (slotLabel) {
    const bySlot = await findPlantBySlot(ownerEmail, input.trayId, slotLabel);
    if (bySlot) {
      return attachExisting(
        ownerEmail,
        input.trayId,
        bySlot,
        input.imageUrl,
        input.capturedAt
      );
    }
  }

  // 5. Create new plant — name/slot from position when known.
  const plants = await listPlantsByTray(ownerEmail, input.trayId);
  const n = plants.length + 1;
  const crop = tray.crop?.trim() || "Unknown";
  const rounded = hasPose
    ? roundPoseForMatch(input.hingeDeg!, input.motorMm!)
    : null;
  const name = rounded
    ? `H${rounded.hingeDeg}° · M${rounded.motorMm}mm`
    : slotLabel
      ? `Pi capture ${slotLabel}`
      : `Pi capture ${n}`;

  const plant = await createManualPlant({
    ownerEmail,
    name,
    cultivar: crop,
    trayId: input.trayId,
    slotLabel: slotLabel ?? (rounded ? poseSlotLabel(rounded.hingeDeg, rounded.motorMm) : undefined),
    row: poseHint.row,
    column: poseHint.column,
    plantIdentifier: rounded
      ? poseSlotLabel(rounded.hingeDeg, rounded.motorMm)
      : undefined,
    latestDiagnosis: "Awaiting first photo analysis"
  });

  await touchPlantLastImage({
    ownerEmail,
    plantId: plant.id,
    trayId: input.trayId,
    imageUrl: input.imageUrl,
    capturedAt: input.capturedAt
  });

  const refreshed = await getPlantById(ownerEmail, plant.id);
  return { plant: refreshed ?? plant, created: true };
}
