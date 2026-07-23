import { readFile } from "fs/promises";

import { hasSpeciesInferenceConfig } from "@/lib/config/env";
import { analyzeExistingCaptureForPlant } from "@/lib/services/plant-manual-service";
import { getPlantById } from "@/lib/services/plant-service";
import { recordMonitoringEvent } from "@/lib/services/monitoring-service";
import type { CameraCapture } from "@/lib/types/domain";

/**
 * After successful Pi ingest / direct capture, optionally run leaf
 * species/disease classification. Failures are monitoring events only.
 */
export async function triggerDiseaseAfterPiIngest(input: {
  ownerEmail: string;
  trayId: string;
  plantId: string;
  capture: CameraCapture;
  imageUrl: string;
  absolutePath: string;
}): Promise<void> {
  try {
    if (!hasSpeciesInferenceConfig) {
      await recordMonitoringEvent({
        trayId: input.trayId,
        plantId: input.plantId,
        captureId: input.capture.id,
        level: "warning",
        title: "Pi ingest disease detection skipped",
        message:
          "CV_SPECIES_INFERENCE_URL is not configured; capture saved without classification."
      });
      return;
    }

    const plant = await getPlantById(input.ownerEmail, input.plantId);
    if (!plant || plant.trayId !== input.trayId) {
      await recordMonitoringEvent({
        trayId: input.trayId,
        plantId: input.plantId,
        captureId: input.capture.id,
        level: "warning",
        title: "Pi ingest disease detection skipped",
        message: "Plant not found on tray for disease classification."
      });
      return;
    }

    const bytes = await readFile(input.absolutePath);
    const result = await analyzeExistingCaptureForPlant({
      ownerEmail: input.ownerEmail,
      plant,
      capture: input.capture,
      imageBytes: bytes,
      imageUrl: input.imageUrl
    });

    await recordMonitoringEvent({
      trayId: input.trayId,
      plantId: input.plantId,
      captureId: input.capture.id,
      level: "info",
      title: "Pi ingest disease detection complete",
      message: `${result.report.diagnosis} (confidence=${(result.prediction.confidence * 100).toFixed(0)}%, severity=${result.prediction.severity}).`
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown disease detection failure";
    try {
      await recordMonitoringEvent({
        trayId: input.trayId,
        plantId: input.plantId,
        captureId: input.capture.id,
        level: "warning",
        title: "Pi ingest disease detection failed",
        message
      });
    } catch {
      // swallow secondary failures
    }
  }
}
