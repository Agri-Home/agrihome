import { randomUUID } from "crypto";

import type {
  CameraCapture,
  PlantReport,
  PlantUnit,
  PredictionResult
} from "@/lib/types/domain";
import type { PlantSpeciesDetection } from "@/lib/services/plant-detection-service";

function severityFromCondition(
  detection: PlantSpeciesDetection
): PredictionResult["severity"] {
  if (detection.isHealthy === true) {
    return "low";
  }
  const cond = (detection.plantCondition ?? detection.cultivar ?? "").toLowerCase();
  if (cond === "healthy" || cond.endsWith(" healthy")) {
    return "low";
  }
  if (
    /blight|rot|virus|bacterial|mold|mildew|scab|rust|mosaic|curl|wilt|canker|spot|scorch|measles|greening/i.test(
      cond
    )
  ) {
    return "high";
  }
  return "medium";
}

/**
 * Prediction + plant report aligned with leaf-classifier output (replaces mock capture hash).
 */
export function buildPredictionAndReportFromSpeciesDetection(
  plant: PlantUnit,
  capture: CameraCapture,
  detection: PlantSpeciesDetection
): { prediction: PredictionResult; report: PlantReport } {
  const cond = detection.plantCondition ?? detection.cultivar;
  const severity = severityFromCondition(detection);
  const confidence = detection.identificationConfidence;
  let label =
    detection.rawLabel && detection.rawLabel.includes("___")
      ? `${detection.commonName} · ${cond}`
      : `${detection.commonName}: ${cond}`;
  if (label.length > 120) {
    label = `${label.slice(0, 117)}...`;
  }

  const recommendation =
    severity === "low"
      ? "No treatment indicated from disease classes; keep routine monitoring."
      : severity === "high"
        ? "Strong disease-class signal; inspect plant and consider crop-specific treatment."
        : "Possible stress or early symptoms; re-check in 24–48h with a clear leaf photo.";

  const prediction: PredictionResult = {
    id: randomUUID(),
    captureId: capture.id,
    trayId: capture.trayId,
    label,
    confidence,
    severity,
    recommendation,
    vectorSource: "classifier",
    createdAt: capture.capturedAt,
    similarMatches: []
  };

  const diseases =
    severity === "low" ? [] : [cond || detection.commonName];
  const diagnosis =
    severity === "low"
      ? `Leaf classifier: ${detection.commonName} (healthy class)`
      : `Leaf classifier: ${detection.commonName} — ${cond}`;

  const report: PlantReport = {
    id: randomUUID(),
    trayId: plant.trayId,
    plantId: plant.id,
    captureId: capture.id,
    diagnosis,
    confidence,
    severity,
    diseases,
    deficiencies: [],
    anomalies:
      severity === "high"
        ? [`Predicted class: ${detection.rawLabel ?? cond}`]
        : severity === "medium"
          ? [`Predicted class: ${detection.rawLabel ?? cond}`]
          : [],
    summary: `Classifier confidence ${(confidence * 100).toFixed(0)}% (${detection.rawLabel ?? label}). Not a substitute for lab or expert diagnosis.`,
    recommendedAction: recommendation,
    status: severity === "high" ? "pending_review" : "ready",
    createdAt: capture.capturedAt
  };

  return { prediction, report };
}
