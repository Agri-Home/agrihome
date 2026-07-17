import { readFile } from "fs/promises";

import { recordMonitoringEvent } from "@/lib/services/monitoring-service";
import {
  analyzeTrayImageForPlantInstances,
  persistTrayVisionResult
} from "@/lib/services/tray-vision-service";

/**
 * AGRI-107: after successful Pi ingest, optionally run tray vision.
 * Failures are monitoring events only — never fail the ingest path.
 */
export async function triggerVisionAfterPiIngest(input: {
  ownerEmail: string;
  trayId: string;
  captureId: string;
  imageUrl: string;
  absolutePath: string;
}): Promise<void> {
  try {
    const bytes = await readFile(input.absolutePath);
    const vision = await analyzeTrayImageForPlantInstances(bytes);
    await persistTrayVisionResult(input.trayId, vision);
    await recordMonitoringEvent({
      trayId: input.trayId,
      captureId: input.captureId,
      level: "info",
      title: "Pi ingest tray vision complete",
      message: `Detected ${vision.count} plant instance(s) (source=${vision.source}, confidence=${vision.countConfidence}).`
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown vision failure";
    try {
      await recordMonitoringEvent({
        trayId: input.trayId,
        captureId: input.captureId,
        level: "warning",
        title: "Pi ingest tray vision failed",
        message
      });
    } catch {
      // swallow secondary failures
    }
  }
}
