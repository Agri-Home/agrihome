import type { FirebaseClientConfig } from "@/lib/types/auth";

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMultilineSecret = (value: string | undefined) =>
  (value ?? "").replace(/\\n/g, "\n");

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
      process.env.POSTGRES_DATABASE ?? process.env.MARIADB_DATABASE ?? ""
  },
  /** Optional ImageFolder copy of feedback (same layout as PlantVillage raw/color). */
  feedback: {
    plantVillageDatasetDir:
      process.env.PLANTVILLAGE_FEEDBACK_DATASET_DIR?.trim() ?? ""
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? "",
    apiKey: process.env.QDRANT_API_KEY ?? "",
    collection: process.env.QDRANT_COLLECTION ?? "agrihome-image-embeddings"
  },
  /** Optional HTTP endpoints for CV (see docs/CV_PIPELINE.md). */
  cv: {
    trayInferenceUrl: process.env.CV_TRAY_INFERENCE_URL ?? "",
    trayInferenceApiKey: process.env.CV_TRAY_INFERENCE_API_KEY ?? "",
    /** Close-up / leaf photo → species labels (train on e.g. Kaggle plant-identification). */
    speciesInferenceUrl: process.env.CV_SPECIES_INFERENCE_URL ?? "",
    speciesInferenceApiKey: process.env.CV_SPECIES_INFERENCE_API_KEY ?? ""
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
