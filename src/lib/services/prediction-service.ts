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
  ownerEmail: string,
  trayId?: string
): Promise<PredictionResult | null> => {
  const latestCapture = await getLatestCameraCapture(ownerEmail, trayId);

  if (!latestCapture) {
    return null;
  }

  const values: string[] = [ownerEmail];
  const clauses = [`t.owner_email = $1`];

  if (trayId) {
    values.push(trayId);
    clauses.push(`pr.tray_id = $${values.length}`);
  }

  const rows = await queryRows<PredictionRow>(
    `SELECT pr.id AS id, pr.capture_id AS capture_id, pr.tray_id AS tray_id,
            pr.label AS label, pr.confidence AS confidence,
            pr.severity AS severity, pr.recommendation AS recommendation,
            pr.vector_source AS vector_source, pr.created_at AS created_at
     FROM prediction_results pr
     INNER JOIN tray_systems t ON t.id = pr.tray_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY pr.created_at DESC
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
