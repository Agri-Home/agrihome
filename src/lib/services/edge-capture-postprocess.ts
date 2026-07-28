import { env } from "@/lib/config/env";
import { ensurePlantForEdgeCapture } from "@/lib/services/edge-plant-attach-service";
import type { CameraCapture } from "@/lib/types/domain";

export type EdgeCapturePostprocessResult = {
  plantId: string;
  plantCreated: boolean;
};

/**
 * After a Pi/Klipper frame is on disk and ingested: attach/create a tray
 * plant, then best-effort async tray vision + disease classification.
 */
export async function postprocessEdgeCapture(input: {
  ownerEmail: string;
  trayId: string;
  capture: CameraCapture;
  imageUrl: string;
  absolutePath: string;
  plantId?: string;
  poseOrder?: number;
  slotLabel?: string;
}): Promise<EdgeCapturePostprocessResult> {
  const attached = await ensurePlantForEdgeCapture({
    ownerEmail: input.ownerEmail,
    trayId: input.trayId,
    imageUrl: input.imageUrl,
    capturedAt: input.capture.capturedAt,
    plantId: input.plantId,
    poseOrder: input.poseOrder,
    slotLabel: input.slotLabel
  });

  if (input.capture.plantId !== attached.plant.id) {
    const { requirePostgresPool } = await import("@/lib/db/postgres");
    const pool = requirePostgresPool();
    await pool.query(
      `UPDATE camera_captures SET plant_id = $1 WHERE id = $2`,
      [attached.plant.id, input.capture.id]
    );
    input.capture.plantId = attached.plant.id;
  }

  if (env.device.autoVisionOnIngest) {
    void import("@/lib/services/edge-vision-hook").then((m) =>
      m.triggerVisionAfterPiIngest({
        ownerEmail: input.ownerEmail,
        trayId: input.trayId,
        captureId: input.capture.id,
        imageUrl: input.imageUrl,
        absolutePath: input.absolutePath
      })
    );
  }

  if (env.device.autoDiseaseOnIngest) {
    void import("@/lib/services/edge-disease-hook").then((m) =>
      m.triggerDiseaseAfterPiIngest({
        ownerEmail: input.ownerEmail,
        trayId: input.trayId,
        plantId: attached.plant.id,
        capture: input.capture,
        imageUrl: input.imageUrl,
        absolutePath: input.absolutePath
      })
    );
  }

  return {
    plantId: attached.plant.id,
    plantCreated: attached.created
  };
}
