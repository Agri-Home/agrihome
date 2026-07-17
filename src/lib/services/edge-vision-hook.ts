import { recordMonitoringEvent } from "@/lib/services/monitoring-service";

/**
 * Optional post-ingest CV hook (AGRI-107).
 * Never throws to the ingest caller — failures are monitoring events only.
 */
export async function triggerVisionAfterPiIngest(_input: {
  ownerEmail: string;
  trayId: string;
  captureId: string;
  imageUrl: string;
  absolutePath: string;
}): Promise<void> {
  // Enabled in AGRI-107; stub keeps ingest resilient when flag is on early.
  try {
    await recordMonitoringEvent({
      trayId: _input.trayId,
      captureId: _input.captureId,
      level: "info",
      title: "Pi ingest CV deferred",
      message:
        "DEVICE_AUTO_VISION_ON_INGEST is set; full tray/species automation lands in AGRI-107."
    });
  } catch {
    // swallow
  }
}
