const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  appName: process.env.APP_NAME ?? "AgriHome Vision Console",
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000",
  autoRefreshMs: parseNumber(process.env.NEXT_PUBLIC_AUTO_REFRESH_MS, 15000),
  useMockData: (process.env.NEXT_PUBLIC_USE_MOCK_DATA ?? "true") !== "false",
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
  qdrant: {
    url: process.env.QDRANT_URL ?? "",
    apiKey: process.env.QDRANT_API_KEY ?? "",
    collection: process.env.QDRANT_COLLECTION ?? "agrihome-image-embeddings"
  },
  /** Optional HTTP endpoint for tray photo → plant count + boxes (see docs/CV_KAGGLE_PIPELINE.md). */
  cv: {
    trayInferenceUrl: process.env.CV_TRAY_INFERENCE_URL ?? "",
    trayInferenceApiKey: process.env.CV_TRAY_INFERENCE_API_KEY ?? ""
  }
};

export const hasPostgresConfig = Boolean(
  env.postgres.host &&
    env.postgres.user &&
    env.postgres.database
);

export const hasVectorConfig = Boolean(env.qdrant.url);

export const hasTrayVisionInferenceConfig = Boolean(env.cv.trayInferenceUrl);
