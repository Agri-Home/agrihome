/**
 * Verifies POSTGRES_STATEMENT_TIMEOUT_MS with a deliberately slow query.
 * Exits successfully when the server cancels pg_sleep with SQLSTATE 57014.
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const rootDir = path.join(__dirname, "..");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) {
    return out;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadDotenvFiles() {
  const merged = {
    ...parseEnvFile(path.join(rootDir, ".env")),
    ...parseEnvFile(path.join(rootDir, ".env.local"))
  };
  for (const [key, value] of Object.entries(merged)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotenvFiles();

const host = process.env.POSTGRES_HOST || "";
const user = process.env.POSTGRES_USER || "";
const database = process.env.POSTGRES_DATABASE || "";
const statementTimeoutMs = Math.max(
  0,
  Number(process.env.POSTGRES_STATEMENT_TIMEOUT_MS || 0)
);

if (!host || !user || !database) {
  console.error(
    "Missing POSTGRES_HOST, POSTGRES_USER, or POSTGRES_DATABASE in the environment."
  );
  process.exit(1);
}

if (!statementTimeoutMs) {
  console.log("POSTGRES_STATEMENT_TIMEOUT_MS is 0; timeout is disabled.");
  process.exit(0);
}

const pool = new Pool({
  host,
  port: Number(process.env.POSTGRES_PORT || 5432),
  user,
  password: process.env.POSTGRES_PASSWORD || "",
  database,
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECT_TIMEOUT_MS || 8000),
  options: `-c statement_timeout=${Math.floor(statementTimeoutMs)}`
});

async function main() {
  const sleepSeconds = Math.min(statementTimeoutMs + 1000, 5000) / 1000;
  try {
    await pool.query("SELECT pg_sleep($1)", [sleepSeconds]);
    console.error("Expected statement timeout, but the slow query completed.");
    process.exitCode = 1;
  } catch (err) {
    if (err && err.code === "57014") {
      console.log(
        `Statement timeout verified at ${statementTimeoutMs}ms with pg_sleep(${sleepSeconds}).`
      );
      return;
    }
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
