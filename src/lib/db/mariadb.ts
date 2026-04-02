import * as mariadb from "mariadb";

import { env, hasMariaDbConfig } from "@/lib/config/env";

declare global {
  // eslint-disable-next-line no-var
  var __agrihomeMariaDbPool__:
    | mariadb.Pool
    | null
    | undefined;
}

export const getMariaDbPool = () => {
  if (!hasMariaDbConfig) {
    return null;
  }

  if (!globalThis.__agrihomeMariaDbPool__) {
    globalThis.__agrihomeMariaDbPool__ = mariadb.createPool({
      host: env.mariadb.host,
      port: env.mariadb.port,
      user: env.mariadb.user,
      password: env.mariadb.password,
      database: env.mariadb.database,
      connectionLimit: 5
    });
  }

  return globalThis.__agrihomeMariaDbPool__;
};
