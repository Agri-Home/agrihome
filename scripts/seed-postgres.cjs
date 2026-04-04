/**
 * Applies db/schema.sql then db/seed.sql (CREATE IF NOT EXISTS + idempotent seed).
 * Loads repo-root `.env` then `.env.local` when vars are not already set (like Next.js).
 * Usage: yarn db:seed   or   POSTGRES_HOST=... node scripts/seed-postgres.cjs
 * Flags:
 *   --schema-only  apply db/schema.sql only
 *   --seed-only    apply db/seed.sql only (tables must already exist)
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

/** Merge .env then .env.local; only fills process.env keys that are still undefined. */
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
if (!host || !user || !database) {
  console.error(
    "Missing POSTGRES_HOST, POSTGRES_USER, or POSTGRES_DATABASE in the environment."
  );
  process.exit(1);
}

const pool = new Pool({
  host,
  port: Number(process.env.POSTGRES_PORT || 5432),
  user,
  password: process.env.POSTGRES_PASSWORD || "",
  database
});

const schemaPath = path.join(rootDir, "db", "schema.sql");
const seedPath = path.join(rootDir, "db", "seed.sql");
const schemaOnly = process.argv.includes("--schema-only");
const seedOnly = process.argv.includes("--seed-only");

async function main() {
  if (schemaOnly && seedOnly) {
    console.error("Use only one of --schema-only or --seed-only.");
    process.exit(1);
  }

  if (!seedOnly) {
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schemaSql);
    console.log("Schema applied:", schemaPath);
  }

  if (!schemaOnly) {
    const seedSql = fs.readFileSync(seedPath, "utf8");
    await pool.query(seedSql);
    console.log("Seed applied:", seedPath);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
