import { Pool } from "pg";

import { env, hasPostgresConfig } from "@/lib/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __agrihomePostgresPool__: Pool | null | undefined;
}

export const getPostgresPool = () => {
  if (!hasPostgresConfig) {
    return null;
  }

  if (!globalThis.__agrihomePostgresPool__) {
    globalThis.__agrihomePostgresPool__ = new Pool({
      host: env.postgres.host,
      port: env.postgres.port,
      user: env.postgres.user,
      password: env.postgres.password,
      database: env.postgres.database,
      max: 5
    });
  }

  return globalThis.__agrihomePostgresPool__;
};

export const queryRows = async <TRow>(
  text: string,
  values: Array<string | number | boolean | null> = []
) => {
  const pool = getPostgresPool();

  if (!pool) {
    return [];
  }

  const result = await pool.query(text, values);

  return result.rows as TRow[];
};

export const isPostgresHealthy = async () => {
  const pool = getPostgresPool();

  if (!pool) {
    return false;
  }

  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
};
