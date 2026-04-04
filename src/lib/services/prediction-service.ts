import { queryRows } from "@/lib/db/postgres";
import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { findSimilarImages } from "@/lib/services/vector-service";
import type { PredictionResult } from "@/lib/types/domain";

interface PredictionRow {
  id: string;
  capture_id: string;
  tray_id: string;
  label: string;
  confidence: number;
  severity: PredictionResult["severity"];
  recommendation: string;
  vector_source: PredictionResult["vectorSource"];
  created_at: Date | string;
}

export const getPredictionDataSource = async () => "postgres" as const;

export const getLatestPrediction = async (
  trayId?: string
): Promise<PredictionResult | null> => {
  const latestCapture = await getLatestCameraCapture(trayId);

  if (!latestCapture) {
    return null;
  }

  const values: string[] = [];
  const whereClause = trayId
    ? (() => {
        values.push(trayId);
        return `WHERE tray_id = $${values.length}`;
      })()
    : "";
  const rows = await queryRows<PredictionRow>(
    `SELECT id, capture_id, tray_id, label, confidence, severity, recommendation,
            vector_source, created_at
     FROM prediction_results
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT 1`,
    values
  );

  if (!rows[0]) {
    return null;
  }

  return {
    id: rows[0].id,
    captureId: rows[0].capture_id,
    trayId: rows[0].tray_id,
    label: rows[0].label,
    confidence: Number(rows[0].confidence),
    severity: rows[0].severity,
    recommendation: rows[0].recommendation,
    vectorSource: rows[0].vector_source,
    createdAt: new Date(rows[0].created_at).toISOString(),
    similarMatches: await findSimilarImages(latestCapture)
  };
};
