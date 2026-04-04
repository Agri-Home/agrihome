import { MANUAL_TRAY_ID } from "@/lib/constants/manual-tray";
import { requirePostgresPool } from "@/lib/db/postgres";
import { buildPredictionAndReportFromSpeciesDetection } from "@/lib/services/species-detection-report";
import { ingestCameraCapture } from "@/lib/services/camera-service";
import {
  detectPlantSpeciesFromImage,
  type PlantSpeciesDetection
} from "@/lib/services/plant-detection-service";
import { getPlantById } from "@/lib/services/plant-service";
import { getTrayById } from "@/lib/services/topology-service";
import { savePlantLeafOriginal } from "@/lib/storage/save-original";
import type {
  CameraCapture,
  PlantReport,
  PlantUnit,
  PredictionResult
} from "@/lib/types/domain";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export async function createManualPlant(input: {
  name: string;
  cultivar: string;
  trayId?: string;
}): Promise<PlantUnit> {
  const trayId = input.trayId?.trim() || MANUAL_TRAY_ID;
  const name = input.name?.trim();
  const cultivar = input.cultivar?.trim();
  if (!name || !cultivar) {
    throw new Error("Name and cultivar are required");
  }

  const pool = requirePostgresPool();
  return createManualPlantPostgres(pool, { name, cultivar, trayId });
}

async function createManualPlantPostgres(
  pool: import("pg").Pool,
  {
    name,
    cultivar,
    trayId
  }: { name: string; cultivar: string; trayId: string }
): Promise<PlantUnit> {
  if (trayId === MANUAL_TRAY_ID) {
    await pool.query(
      `INSERT INTO tray_systems
        (id, name, zone, crop, plant_count, health_score, status, device_id, last_capture_at)
       VALUES ($1, $2, $3, $4, 0, 92, 'healthy', 'user-device', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [MANUAL_TRAY_ID, "My plants", "Manual entry", "Custom"]
    );
  }

  const trayCheck = await pool.query(`SELECT id FROM tray_systems WHERE id = $1`, [
    trayId
  ]);
  if (trayCheck.rowCount === 0) {
    throw new Error("Tray not found");
  }

  const countRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::int AS c FROM plants WHERE tray_id = $1`,
    [trayId]
  );
  const n = Number(countRes.rows[0].c) + 1;
  const plantId = `plant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO plants
      (id, tray_id, mesh_ids, name, cultivar, slot_label, row_index, column_index,
       health_score, status, last_report_at, latest_diagnosis, last_image_url, last_image_at)
     VALUES ($1,$2,$3::json,$4,$5,$6,$7,$8,88,'healthy',$9,$10,NULL,NULL)`,
    [
      plantId,
      trayId,
      JSON.stringify([]),
      name,
      cultivar,
      `M-${n}`,
      Math.ceil(n / 3),
      ((n - 1) % 3) + 1,
      now,
      "Awaiting first photo analysis"
    ]
  );

  await pool.query(
    `UPDATE tray_systems SET plant_count = plant_count + 1 WHERE id = $1`,
    [trayId]
  );

  return {
    id: plantId,
    trayId,
    meshIds: [],
    name,
    cultivar,
    slotLabel: `M-${n}`,
    row: Math.ceil(n / 3),
    column: ((n - 1) % 3) + 1,
    healthScore: 88,
    status: "healthy",
    lastReportAt: now,
    latestDiagnosis: "Awaiting first photo analysis",
    lastImageUrl: null,
    lastImageAt: now
  };
}

function assertImageMime(mime: string): "png" | "webp" | "jpg" {
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/jpeg" || mime === "image/jpg"
          ? "jpg"
          : null;
  if (!ext) {
    throw new Error("Use JPEG, PNG, or WebP");
  }
  return ext;
}

export async function persistPlantPhotoAndAnalyze(
  plant: PlantUnit,
  file: Buffer,
  mime: string,
  captureNotes?: string,
  speciesDetection?: PlantSpeciesDetection | null
): Promise<{
  captureId: string;
  imageUrl: string;
  report: PlantReport;
  prediction: PredictionResult;
}> {
  if (file.length > MAX_UPLOAD_BYTES) {
    throw new Error("Image too large (max 6MB)");
  }

  const ext = assertImageMime(mime);
  const { imageUrl } = await savePlantLeafOriginal(file, ext);

  const tray = await getTrayById(plant.trayId);
  const trayName = tray?.name ?? plant.trayId;

  const capture = await ingestCameraCapture({
    id: `capture-${plant.id}-${Date.now()}`,
    trayId: plant.trayId,
    trayName,
    deviceId: "user-photo",
    imageUrl,
    source: "hardware",
    notes: captureNotes ?? "User-submitted plant photo"
  });

  const pool = requirePostgresPool();
  const detection =
    speciesDetection ?? (await detectPlantSpeciesFromImage(file));

  return finalizePhotoPostgres(pool, plant, capture, imageUrl, detection);
}

export async function analyzePlantPhotoFromUpload(
  plantId: string,
  file: Buffer,
  mime: string
): Promise<{
  captureId: string;
  imageUrl: string;
  report: PlantReport;
  prediction: PredictionResult;
}> {
  const plant = await getPlantById(plantId);
  if (!plant) {
    throw new Error("Plant not found");
  }
  return persistPlantPhotoAndAnalyze(plant, file, mime);
}

/**
 * Photo-first flow: species/cultivar from the leaf classifier, then plant row + health report.
 */
export async function createPlantFromPhotoWithAutoDetection(input: {
  file: Buffer;
  mime: string;
  trayId?: string;
  /** Optional override of auto-detected display name */
  displayName?: string;
  /** Optional override of auto-detected cultivar / species string */
  cultivarOverride?: string;
}): Promise<{
  plant: PlantUnit;
  detection: PlantSpeciesDetection;
  captureId: string;
  imageUrl: string;
  report: PlantReport;
  prediction: PredictionResult;
}> {
  if (input.file.length > MAX_UPLOAD_BYTES) {
    throw new Error("Image too large (max 6MB)");
  }

  const detection = await detectPlantSpeciesFromImage(input.file);
  const name = input.displayName?.trim() || detection.commonName;
  const cultivar =
    input.cultivarOverride?.trim() || detection.cultivar;

  const plant = await createManualPlant({
    name,
    cultivar,
    trayId: input.trayId
  });

  const cond = detection.plantCondition ?? detection.cultivar;
  const notes = `Species ID: ${detection.commonName} · ${cond} · ${(detection.identificationConfidence * 100).toFixed(0)}% confidence`;

  const analysis = await persistPlantPhotoAndAnalyze(
    plant,
    input.file,
    input.mime,
    notes,
    detection
  );

  const updated = await getPlantById(plant.id);

  return {
    plant: updated ?? plant,
    detection,
    ...analysis
  };
}

async function finalizePhotoPostgres(
  pool: import("pg").Pool,
  plant: PlantUnit,
  capture: CameraCapture,
  imagePublicPath: string,
  speciesDetection: PlantSpeciesDetection
): Promise<{
  captureId: string;
  imageUrl: string;
  report: PlantReport;
  prediction: PredictionResult;
}> {
  const { prediction, report } = buildPredictionAndReportFromSpeciesDetection(
    plant,
    capture,
    speciesDetection
  );

  const newHealth =
    prediction.severity === "high"
      ? Math.max(plant.healthScore - 8, 44)
      : prediction.severity === "medium"
        ? Math.max(plant.healthScore - 4, 60)
        : Math.min(plant.healthScore + 2, 98);
  const newStatus =
    prediction.severity === "high"
      ? "alert"
      : prediction.severity === "medium"
        ? "watch"
        : "healthy";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO prediction_results
        (id, capture_id, tray_id, label, confidence, severity, recommendation, vector_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        prediction.id,
        capture.id,
        capture.trayId,
        prediction.label,
        prediction.confidence,
        prediction.severity,
        prediction.recommendation,
        prediction.vectorSource
      ]
    );
    await client.query(
      `INSERT INTO plant_reports
        (id, tray_id, plant_id, capture_id, diagnosis, confidence, severity,
         diseases, deficiencies, anomalies, summary, recommended_action, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::json,$9::json,$10::json,$11,$12,$13)`,
      [
        report.id,
        report.trayId,
        report.plantId,
        capture.id,
        report.diagnosis,
        report.confidence,
        report.severity,
        JSON.stringify(report.diseases),
        JSON.stringify(report.deficiencies),
        JSON.stringify(report.anomalies),
        report.summary,
        report.recommendedAction,
        report.status
      ]
    );
    await client.query(
      `UPDATE plants
       SET last_image_url = $1, last_image_at = NOW(), health_score = $2,
           status = $3, latest_diagnosis = $4, last_report_at = NOW()
       WHERE id = $5`,
      [imagePublicPath, newHealth, newStatus, report.diagnosis, plant.id]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return {
    captureId: capture.id,
    imageUrl: imagePublicPath,
    report,
    prediction
  };
}
