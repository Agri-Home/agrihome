import { MANUAL_TRAY_ID } from "@/lib/constants/manual-tray";
import { buildManualTrayId } from "@/lib/auth/account";
import { requirePostgresPool } from "@/lib/db/postgres";
import { buildPredictionAndReportFromSpeciesDetection } from "@/lib/services/species-detection-report";
import { ingestCameraCapture } from "@/lib/services/camera-service";
import {
  detectPlantSpeciesFromImage,
  type PlantSpeciesDetection
} from "@/lib/services/plant-detection-service";
import {
  recordTrainingFeedbackSample,
  trainingFeedbackFieldsPresent
} from "@/lib/feedback/training-sample";
import { getPlantById } from "@/lib/services/plant-service";
import { getTrayById, syncTrayStatsFromPlants } from "@/lib/services/topology-service";
import { savePlantLeafOriginal } from "@/lib/storage/save-original";
import type {
  CameraCapture,
  PlantHealthStatus,
  PlantReport,
  PlantUnit,
  PredictionResult
} from "@/lib/types/domain";

const HEALTH_STATUSES: PlantHealthStatus[] = ["healthy", "watch", "alert"];

function clampHealth(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export async function createManualPlant(input: {
  ownerEmail: string;
  name: string;
  cultivar: string;
  trayId?: string;
  row?: number;
  column?: number;
  slotLabel?: string;
  plantIdentifier?: string | null;
  description?: string | null;
  healthScore?: number;
  status?: PlantHealthStatus;
  latestDiagnosis?: string;
}): Promise<PlantUnit> {
  const defaultManualTrayId = buildManualTrayId(input.ownerEmail);
  const requestedTrayId = input.trayId?.trim();
  const trayId =
    !requestedTrayId || requestedTrayId === MANUAL_TRAY_ID
      ? defaultManualTrayId
      : requestedTrayId;
  const name = input.name?.trim();
  const cultivar = input.cultivar?.trim();
  if (!name || !cultivar) {
    throw new Error("Name and cultivar are required");
  }

  const pool = requirePostgresPool();
  return createManualPlantPostgres(pool, {
    ownerEmail: input.ownerEmail,
    name,
    cultivar,
    trayId,
    row: input.row,
    column: input.column,
    slotLabel: input.slotLabel,
    plantIdentifier: input.plantIdentifier,
    description: input.description,
    healthScore: input.healthScore,
    status: input.status,
    latestDiagnosis: input.latestDiagnosis
  });
}

async function createManualPlantPostgres(
  pool: import("pg").Pool,
  {
    ownerEmail,
    name,
    cultivar,
    trayId,
    row: rowIn,
    column: colIn,
    slotLabel: slotIn,
    plantIdentifier: pidIn,
    description: descIn,
    healthScore: healthIn,
    status: statusIn,
    latestDiagnosis: diagIn
  }: {
    ownerEmail: string;
    name: string;
    cultivar: string;
    trayId: string;
    row?: number;
    column?: number;
    slotLabel?: string;
    plantIdentifier?: string | null;
    description?: string | null;
    healthScore?: number;
    status?: PlantHealthStatus;
    latestDiagnosis?: string;
  }
): Promise<PlantUnit> {
  const defaultManualTrayId = buildManualTrayId(ownerEmail);

  if (trayId === defaultManualTrayId) {
    await pool.query(
      `INSERT INTO tray_systems
        (id, owner_email, name, zone, crop, plant_count, health_score, status, device_id, last_capture_at)
       VALUES ($1, $2, $3, $4, $5, 0, 92, 'healthy', 'user-device', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [defaultManualTrayId, ownerEmail, "My plants", "Manual entry", "Custom"]
    );
  }

  const trayCheck = await pool.query(
    `SELECT id
     FROM tray_systems
     WHERE id = $1 AND owner_email = $2`,
    [trayId, ownerEmail]
  );
  if (trayCheck.rowCount === 0) {
    throw new Error("Tray not found");
  }

  const countRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::int AS c
     FROM plants
     WHERE tray_id = $1 AND owner_email = $2`,
    [trayId, ownerEmail]
  );
  const n = Number(countRes.rows[0].c) + 1;

  const hasRow = rowIn !== undefined && Number.isFinite(rowIn);
  const hasCol = colIn !== undefined && Number.isFinite(colIn);
  if (hasRow !== hasCol) {
    throw new Error("Provide both row and column, or neither for auto layout");
  }

  const row = hasRow ? Math.max(1, Math.floor(rowIn!)) : Math.ceil(n / 3);
  const column = hasCol ? Math.max(1, Math.floor(colIn!)) : ((n - 1) % 3) + 1;
  const slotLabel =
    slotIn !== undefined && slotIn.trim()
      ? slotIn.trim().slice(0, 32)
      : hasRow
        ? `R${row}C${column}`
        : `M-${n}`;

  const plantIdentifier =
    pidIn === undefined
      ? null
      : pidIn === null || pidIn === ""
        ? null
        : pidIn.trim().slice(0, 120);

  const description =
    descIn === undefined
      ? null
      : descIn === null || descIn === ""
        ? null
        : descIn.trim().slice(0, 4000);

  const healthScore =
    healthIn !== undefined ? clampHealth(healthIn) : 88;
  const status =
    statusIn !== undefined ? statusIn : "healthy";
  if (!HEALTH_STATUSES.includes(status)) {
    throw new Error("Invalid health status");
  }
  const latestDiagnosis =
    diagIn !== undefined
      ? diagIn.trim().slice(0, 160)
      : "Awaiting first photo analysis";

  const plantId = `plant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO plants
      (id, owner_email, tray_id, mesh_ids, name, cultivar, plant_identifier, slot_label, row_index, column_index,
       health_score, status, last_report_at, latest_diagnosis, description, last_image_url, last_image_at)
     VALUES ($1,$2,$3,$4::json,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NULL,NULL)`,
    [
      plantId,
      ownerEmail,
      trayId,
      JSON.stringify([]),
      name,
      cultivar,
      plantIdentifier,
      slotLabel,
      row,
      column,
      healthScore,
      status,
      now,
      latestDiagnosis,
      description
    ]
  );

  await syncTrayStatsFromPlants(ownerEmail, trayId);

  const loaded = await getPlantById(ownerEmail, plantId);
  if (!loaded) {
    throw new Error("Plant was not created");
  }
  return loaded;
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
  ownerEmail: string,
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

  const tray = await getTrayById(ownerEmail, plant.trayId);
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

  return finalizePhotoPostgres(
    pool,
    ownerEmail,
    plant,
    capture,
    imageUrl,
    detection
  );
}

export async function analyzePlantPhotoFromUpload(
  ownerEmail: string,
  plantId: string,
  file: Buffer,
  mime: string
): Promise<{
  plant: PlantUnit;
  captureId: string;
  imageUrl: string;
  report: PlantReport;
  prediction: PredictionResult;
}> {
  const plant = await getPlantById(ownerEmail, plantId);
  if (!plant) {
    throw new Error("Plant not found");
  }
  const out = await persistPlantPhotoAndAnalyze(ownerEmail, plant, file, mime);
  const updated = await getPlantById(ownerEmail, plantId);
  return {
    plant: updated ?? plant,
    ...out
  };
}

/**
 * Photo-first flow: species/cultivar from the leaf classifier, then plant row + health report.
 */
export async function createPlantFromPhotoWithAutoDetection(input: {
  ownerEmail: string;
  userUid: string;
  file: Buffer;
  mime: string;
  trayId?: string;
  /** Optional override of auto-detected display name */
  displayName?: string;
  /** Optional override of auto-detected cultivar / species string */
  cultivarOverride?: string;
  /** Optional corrections for the same photo (stored for ML training). */
  trainingFeedback?: {
    category: string | null;
    tags: string[];
    comment: string | null;
  } | null;
}): Promise<{
  plant: PlantUnit;
  detection: PlantSpeciesDetection;
  captureId: string;
  imageUrl: string;
  report: PlantReport;
  prediction: PredictionResult;
  trainingFeedback: { id: string } | null;
  trainingFeedbackWarning: string | null;
}> {
  if (input.file.length > MAX_UPLOAD_BYTES) {
    throw new Error("Image too large (max 6MB)");
  }

  const detection = await detectPlantSpeciesFromImage(input.file);
  const name = input.displayName?.trim() || detection.commonName;
  const cultivar =
    input.cultivarOverride?.trim() || detection.cultivar;

  const plant = await createManualPlant({
    ownerEmail: input.ownerEmail,
    name,
    cultivar,
    trayId: input.trayId
  });

  const cond = detection.plantCondition ?? detection.cultivar;
  const notes = `Species ID: ${detection.commonName} · ${cond} · ${(detection.identificationConfidence * 100).toFixed(0)}% confidence`;

  const analysis = await persistPlantPhotoAndAnalyze(
    input.ownerEmail,
    plant,
    input.file,
    input.mime,
    notes,
    detection
  );

  const updated = await getPlantById(input.ownerEmail, plant.id);

  let trainingFeedback: { id: string } | null = null;
  let trainingFeedbackWarning: string | null = null;

  const tf = input.trainingFeedback;
  if (
    tf &&
    trainingFeedbackFieldsPresent(tf.category, tf.comment, tf.tags)
  ) {
    const modelPredictionLabel = [
      `${detection.commonName} (${detection.cultivar})`,
      `${(detection.identificationConfidence * 100).toFixed(0)}%`,
      analysis.report.diagnosis
    ]
      .join(" · ")
      .slice(0, 120);

    try {
      const row = await recordTrainingFeedbackSample({
        userUid: input.userUid,
        ownerEmail: input.ownerEmail,
        buffer: input.file,
        mimeType: input.mime,
        feedbackCategory: tf.category,
        feedbackTags: tf.tags,
        commentText: tf.comment,
        modelPredictionLabel
      });
      trainingFeedback = { id: row.id };
    } catch (e) {
      trainingFeedbackWarning =
        e instanceof Error ? e.message : "Could not save training feedback";
    }
  }

  return {
    plant: updated ?? plant,
    detection,
    ...analysis,
    trainingFeedback,
    trainingFeedbackWarning
  };
}

async function finalizePhotoPostgres(
  pool: import("pg").Pool,
  ownerEmail: string,
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

  await syncTrayStatsFromPlants(ownerEmail, plant.trayId);

  return {
    captureId: capture.id,
    imageUrl: imagePublicPath,
    report,
    prediction
  };
}
