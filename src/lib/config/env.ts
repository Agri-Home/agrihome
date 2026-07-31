import type { FirebaseClientConfig } from "@/lib/types/auth";

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMultilineSecret = (value: string | undefined) =>
  (value ?? "").replace(/\\n/g, "\n");

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

type CaptureCropMode = "center" | "leaf" | "off";
type CaptureRotationDegrees = 0 | 90 | 180 | 270;

const parseCaptureCropMode = (
  value: string | undefined,
  fallback: CaptureCropMode
): CaptureCropMode => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const mode = value.trim().toLowerCase();
  if (
    mode === "0" ||
    mode === "false" ||
    mode === "no" ||
    mode === "off" ||
    mode === "none" ||
    mode === "disable" ||
    mode === "disabled"
  ) {
    return "off";
  }
  if (mode.startsWith("leaf")) {
    return "leaf";
  }
  if (mode.startsWith("center") || /^[\d.]+$/.test(mode)) {
    return "center";
  }
  return fallback;
};

const parseCaptureCropFraction = (
  value: string | undefined,
  cropModeRaw: string | undefined,
  fallback: number
): number => {
  let raw = value;
  if ((raw === undefined || raw.trim() === "") && cropModeRaw) {
    const crop = cropModeRaw.trim().toLowerCase();
    if (crop.includes(":")) {
      raw = crop.split(":", 2)[1]?.trim();
    } else if (/^[\d.]+$/.test(crop)) {
      raw = crop;
    }
  }
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const frac = Number(raw);
  if (!Number.isFinite(frac) || frac < 0.2 || frac > 1) {
    return fallback;
  }
  return frac;
};

const parseCaptureRotation = (
  value: string | undefined,
  fallback: CaptureRotationDegrees
): CaptureRotationDegrees => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const deg = Number(value.trim());
  if (deg === 0 || deg === 90 || deg === 180 || deg === 270) {
    return deg;
  }
  return fallback;
};

const firebaseClientConfig: FirebaseClientConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? "",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    process.env.FIREBASE_AUTH_DOMAIN ??
    "",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID ??
    "",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    process.env.FIREBASE_STORAGE_BUCKET ??
    "",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    process.env.FIREBASE_MESSAGING_SENDER_ID ??
    "",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? "",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ??
    process.env.FIREBASE_MEASUREMENT_ID ??
    ""
};

export const env = {
  appName: process.env.APP_NAME ?? "AgriHome Vision Console",
  isProduction: process.env.NODE_ENV === "production",
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
  autoRefreshMs: parseNumber(process.env.NEXT_PUBLIC_AUTO_REFRESH_MS, 15000),
  postgres: {
    host: process.env.POSTGRES_HOST ?? process.env.MARIADB_HOST ?? "",
    port: parseNumber(
      process.env.POSTGRES_PORT ?? process.env.MARIADB_PORT,
      5432
    ),
    user: process.env.POSTGRES_USER ?? process.env.MARIADB_USER ?? "",
    password: process.env.POSTGRES_PASSWORD ?? process.env.MARIADB_PASSWORD ?? "",
    database:
      process.env.POSTGRES_DATABASE ?? process.env.MARIADB_DATABASE ?? "",
    poolMax: parseNumber(process.env.POSTGRES_POOL_MAX, 5)
  },
  /** Optional ImageFolder copy of feedback (same layout as PlantVillage raw/color). */
  feedback: {
    plantVillageDatasetDir:
      process.env.PLANTVILLAGE_FEEDBACK_DATASET_DIR?.trim() ?? ""
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? "",
    apiKey: process.env.QDRANT_API_KEY ?? "",
    collection: process.env.QDRANT_COLLECTION ?? "agrihome-image-embeddings",
    timeoutMs: parseNumber(process.env.QDRANT_TIMEOUT_MS, 0)
  },
  /** Optional HTTP endpoints for CV (see docs/CV_PIPELINE.md). */
  cv: {
    trayInferenceUrl: process.env.CV_TRAY_INFERENCE_URL ?? "",
    trayInferenceApiKey: process.env.CV_TRAY_INFERENCE_API_KEY ?? "",
    /** Close-up / leaf photo → species labels (train on e.g. Kaggle plant-identification). */
    speciesInferenceUrl: process.env.CV_SPECIES_INFERENCE_URL ?? "",
    speciesInferenceApiKey: process.env.CV_SPECIES_INFERENCE_API_KEY ?? "",
    requestTimeoutMs: parseNumber(process.env.CV_REQUEST_TIMEOUT_MS, 60_000),
    allowDeferred: parseBoolean(process.env.CV_ALLOW_DEFERRED, false)
  },
  firebase: {
    ...firebaseClientConfig,
    client: firebaseClientConfig,
    sessionCookieName:
      process.env.FIREBASE_SESSION_COOKIE_NAME ?? "agrihome_session",
    admin: {
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
      privateKey: normalizeMultilineSecret(process.env.FIREBASE_PRIVATE_KEY),
      serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? ""
    }
  },
  /** Raspberry Pi / Klipper edge device provisioning & ingest. */
  device: {
    provisioningSecret: process.env.DEVICE_PROVISIONING_SECRET?.trim() ?? "",
    defaultOwnerEmail:
      process.env.DEVICE_DEFAULT_OWNER_EMAIL?.trim().toLowerCase() ?? "",
    ingestMaxBytes: parseNumber(
      process.env.DEVICE_INGEST_MAX_BYTES,
      12 * 1024 * 1024
    ),
    ingestMaxPerDevicePerMin: parseNumber(
      process.env.DEVICE_INGEST_MAX_PER_DEVICE_PER_MIN,
      30
    ),
    ingestMaxPerIpPerMin: parseNumber(
      process.env.DEVICE_INGEST_MAX_PER_IP_PER_MIN,
      60
    ),
    heartbeatStaleMinutes: parseNumber(
      process.env.DEVICE_HEARTBEAT_STALE_MINUTES,
      5
    ),
    /** When true, successful Pi ingest may trigger tray CV asynchronously. */
    autoVisionOnIngest: parseBoolean(
      process.env.DEVICE_AUTO_VISION_ON_INGEST,
      false
    ),
    /**
     * When true (default), successful Pi ingest / Take Picture runs leaf
     * species/disease classification asynchronously (failures logged only).
     */
    autoDiseaseOnIngest: parseBoolean(
      process.env.DEVICE_AUTO_DISEASE_ON_INGEST,
      true
    ),
    /** Relative path or absolute URL for optional HTTP still frames (streamer). */
    snapshotPath:
      process.env.AGRIHOME_SNAPSHOT_PATH?.trim() ||
      process.env.DEVICE_SNAPSHOT_PATH?.trim() ||
      "/webcam/?action=snapshot",
    /** Server-side optional streamer fetch timeout (Take Picture fast path). */
    snapshotTimeoutMs: parseNumber(
      process.env.DEVICE_SNAPSHOT_TIMEOUT_MS,
      8_000
    ),
    /**
     * Server-side orientation for raw stills (streamer / save_image.sh).
     * Default 180° for upside-down mounts. Camserver /photo already rotates;
     * raspberry-pi ingest skips this when imagePrepared=camera_server.
     */
    captureRotation: parseCaptureRotation(
      process.env.DEVICE_CAPTURE_ROTATION ??
        process.env.AGRIHOME_CAPTURE_ROTATION,
      180
    ),
    /**
     * Server-side crop after rotation (sharp) for raw stills.
     * Camserver /photo already crops; ingest skips when pre-framed.
     */
    captureCrop: parseCaptureCropMode(
      process.env.DEVICE_CAPTURE_CROP ?? process.env.AGRIHOME_CAPTURE_CROP,
      "center"
    ),
    captureCropFraction: parseCaptureCropFraction(
      process.env.DEVICE_CAPTURE_CROP_FRACTION ??
        process.env.AGRIHOME_CAPTURE_CROP_FRACTION,
      process.env.DEVICE_CAPTURE_CROP ?? process.env.AGRIHOME_CAPTURE_CROP,
      0.6
    )
  }
};

export const hasPostgresConfig = Boolean(
  env.postgres.host &&
    env.postgres.user &&
    env.postgres.database
);

export const hasVectorConfig = Boolean(env.qdrant.url);

export const hasTrayVisionInferenceConfig = Boolean(env.cv.trayInferenceUrl);

export const hasSpeciesInferenceConfig = Boolean(env.cv.speciesInferenceUrl);

export const hasFirebaseClientConfig = Boolean(
  env.firebase.client.apiKey &&
    env.firebase.client.authDomain &&
    env.firebase.client.projectId &&
    env.firebase.client.appId
);

export const hasFirebaseAdminConfig = Boolean(
  env.firebase.admin.serviceAccountJson ||
    (env.firebase.projectId &&
      env.firebase.admin.clientEmail &&
      env.firebase.admin.privateKey) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
);
