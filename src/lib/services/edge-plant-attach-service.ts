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

/**
 * Ensure a plant row exists on the tray for a Pi / Klipper capture.
 * Prefer explicit plantId, then pose plantId/slot, then upsert by slot,
 * otherwise create a new plant with sensible defaults.
 */
export async function ensurePlantForEdgeCapture(input: {
  ownerEmail: string;
  trayId: string;
  imageUrl: string;
  capturedAt: string;
  plantId?: string;
  poseOrder?: number;
  slotLabel?: string;
}): Promise<EdgePlantAttachResult> {
  const ownerEmail = input.ownerEmail.toLowerCase();
  const tray = await getTrayById(ownerEmail, input.trayId);
  if (!tray) {
    throw new Error("Tray not found");
  }

  const poseHint = await resolvePoseHint({
    ownerEmail,
    trayId: input.trayId,
    poseOrder: input.poseOrder
  });

  const candidatePlantId =
    input.plantId?.trim() || poseHint.plantId?.trim() || undefined;
  const slotLabel =
    input.slotLabel?.trim() || poseHint.slotLabel || undefined;

  if (candidatePlantId) {
    const existing = await getPlantById(ownerEmail, candidatePlantId);
    if (existing && existing.trayId === input.trayId) {
      await touchPlantLastImage({
        ownerEmail,
        plantId: existing.id,
        trayId: input.trayId,
        imageUrl: input.imageUrl,
        capturedAt: input.capturedAt
      });
      const refreshed = await getPlantById(ownerEmail, existing.id);
      return { plant: refreshed ?? existing, created: false };
    }
  }

  if (slotLabel) {
    const bySlot = await findPlantBySlot(ownerEmail, input.trayId, slotLabel);
    if (bySlot) {
      await touchPlantLastImage({
        ownerEmail,
        plantId: bySlot.id,
        trayId: input.trayId,
        imageUrl: input.imageUrl,
        capturedAt: input.capturedAt
      });
      const refreshed = await getPlantById(ownerEmail, bySlot.id);
      return { plant: refreshed ?? bySlot, created: false };
    }
  }

  const plants = await listPlantsByTray(ownerEmail, input.trayId);
  const n = plants.length + 1;
  const crop = tray.crop?.trim() || "Unknown";
  const name = slotLabel
    ? `Pi capture ${slotLabel}`
    : `Pi capture ${n}`;

  const plant = await createManualPlant({
    ownerEmail,
    name,
    cultivar: crop,
    trayId: input.trayId,
    slotLabel,
    row: poseHint.row,
    column: poseHint.column,
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
