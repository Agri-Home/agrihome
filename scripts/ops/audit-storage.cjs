#!/usr/bin/env node
/**
 * Dry-run audit of originals on disk vs. Postgres file references.
 *
 * Usage:
 *   node scripts/ops/audit-storage.cjs
 *
 * Env: POSTGRES_*, STORAGE_ROOT / STORAGE_ORIGINALS_DIR
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const rootDir = path.join(__dirname, "..", "..");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
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

function loadDotenv() {
  const merged = {
    ...parseEnvFile(path.join(rootDir, ".env")),
    ...parseEnvFile(path.join(rootDir, ".env.local"))
  };
  for (const [k, v] of Object.entries(merged)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function originalsRoot() {
  const explicit = process.env.STORAGE_ORIGINALS_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  const sr = process.env.STORAGE_ROOT?.trim();
  if (sr) return path.resolve(sr, "originals");
  return path.join(rootDir, "storage", "originals");
}

function urlToStorageKey(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const prefix = "/api/files/originals/";
  if (!imageUrl.startsWith(prefix)) return null;
  return imageUrl.slice(prefix.length);
}

function normalizeKey(key) {
  return key.replace(/\\/g, "/");
}

function walkOriginals(root, onFile) {
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = normalizeKey(path.relative(root, full));
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      onFile(rel, full, stat);
    }
  }

  if (fs.existsSync(root)) {
    walk(root);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

async function loadReferencedKeys(pool) {
  const referenced = new Set();

  const queries = [
    `SELECT last_image_url AS ref FROM plants WHERE last_image_url IS NOT NULL`,
    `SELECT image_url AS ref FROM camera_captures WHERE image_url IS NOT NULL`,
    `SELECT image_url AS ref FROM feedback_ingest WHERE image_url IS NOT NULL`,
    `SELECT image_storage_key AS ref FROM feedback_ingest WHERE image_storage_key IS NOT NULL`
  ];

  for (const sql of queries) {
    const { rows } = await pool.query(sql);
    for (const row of rows) {
      const raw = row.ref;
      if (!raw) continue;
      const fromUrl = urlToStorageKey(raw);
      if (fromUrl) {
        referenced.add(normalizeKey(fromUrl));
        continue;
      }
      referenced.add(normalizeKey(raw));
    }
  }

  return referenced;
}

async function main() {
  loadDotenv();

  const root = originalsRoot();
  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "agrihome",
    password: process.env.POSTGRES_PASSWORD ?? "",
    database: process.env.POSTGRES_DATABASE ?? "agrihome"
  });

  const referenced = await loadReferencedKeys(pool);
  await pool.end();

  const files = [];
  walkOriginals(root, (rel, full, stat) => {
    files.push({ rel, full, size: stat.size, mtimeMs: stat.mtimeMs });
  });

  const orphans = files.filter((f) => !referenced.has(f.rel));
  const referencedOnDisk = files.length - orphans.length;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const orphanBytes = orphans.reduce((sum, f) => sum + f.size, 0);

  orphans.sort((a, b) => b.size - a.size);
  const largestOrphans = orphans.slice(0, 10);

  console.log("AgriHome storage audit (originals)");
  console.log("mode: dry-run");
  console.log(`scanned_root: [configured originals volume]`);
  console.log("");
  console.log(`total_files: ${files.length}`);
  console.log(`total_bytes: ${totalBytes} (${formatBytes(totalBytes)})`);
  console.log(`referenced_on_disk: ${referencedOnDisk}`);
  console.log(`db_reference_count: ${referenced.size}`);
  console.log(`orphan_candidates: ${orphans.length}`);
  console.log(`orphan_bytes: ${orphanBytes} (${formatBytes(orphanBytes)})`);
  console.log("");
  console.log("largest_orphan_candidates:");
  if (!largestOrphans.length) {
    console.log("  (none)");
  } else {
    for (const item of largestOrphans) {
      console.log(`  ${formatBytes(item.size).padStart(10)}  ${item.rel}`);
    }
  }

  console.log("");
  console.log("dry-run only — no files deleted.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
