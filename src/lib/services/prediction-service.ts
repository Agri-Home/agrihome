import { env } from "@/lib/config/env";
import { getPostgresPool, queryRows } from "@/lib/db/postgres";
import { derivePredictionFromCapture } from "@/lib/mocks/data";
import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMockStore } from "@/lib/services/mock-store";
import { findSimilarImages, getVectorSource } from "@/lib/services/vector-service";
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

export const getPredictionDataSource = async () => {
  const pool = getPostgresPool();

  return !env.useMockData && pool ? "postgres" : "mock";
};

export const getLatestPrediction = async (
  trayId?: string
): Promise<PredictionResult | null> => {
  const latestCapture = await getLatestCameraCapture(trayId);

  if (!latestCapture) {
    return null;
  }

  const pool = getPostgresPool();

  if (!env.useMockData && pool) {
    try {
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

      if (rows[0]) {
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
      }
    } catch {
      // Fall back to mock prediction below.
    }
  }

  const storePrediction = getMockStore().predictions.find(
    (prediction) =>
      prediction.captureId === latestCapture.id &&
      (trayId ? prediction.trayId === trayId : true)
  );
  const prediction = storePrediction ?? derivePredictionFromCapture(latestCapture);

  return {
    ...prediction,
    vectorSource: getVectorSource(),
    similarMatches: await findSimilarImages(latestCapture)
  };
};
