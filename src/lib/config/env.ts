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
  mariadb: {
    host: process.env.MARIADB_HOST ?? "",
    port: parseNumber(process.env.MARIADB_PORT, 3306),
    user: process.env.MARIADB_USER ?? "",
    password: process.env.MARIADB_PASSWORD ?? "",
    database: process.env.MARIADB_DATABASE ?? ""
  },
  qdrant: {
    url: process.env.QDRANT_URL ?? "",
    apiKey: process.env.QDRANT_API_KEY ?? "",
    collection: process.env.QDRANT_COLLECTION ?? "agrihome-image-embeddings"
  }
};

export const hasMariaDbConfig = Boolean(
  env.mariadb.host &&
    env.mariadb.user &&
    env.mariadb.database
);

export const hasVectorConfig = Boolean(env.qdrant.url);
