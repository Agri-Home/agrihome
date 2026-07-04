#!/usr/bin/env node
/**
 * Dry-run audit of originals on disk vs. Postgres file references.
 *
 * Usage:
 *   node scripts/ops/audit-storage.cjs
 *   node scripts/ops/audit-storage.cjs --delete --older-than-days=90
 *
 * Deletion requires BOTH --delete and --older-than-days=N. Read-only by default.
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

function parseArgs(argv) {
  const flags = {
    delete: false,
    olderThanDays: null
  };

  for (const arg of argv) {
    if (arg === "--delete") {
      flags.delete = true;
      continue;
    }
    const match = arg.match(/^--older-than-days=(\d+)$/);
    if (match) {
      flags.olderThanDays = Number(match[1]);
    }
  }

  return flags;
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

function validateDeleteFlags(flags) {
  if (flags.delete && flags.olderThanDays === null) {
    console.error("error: --delete requires --older-than-days=N");
    process.exit(1);
  }
  if (!flags.delete && flags.olderThanDays !== null) {
    console.error("error: --older-than-days=N requires --delete (dry-run is the default)");
    process.exit(1);
  }
  if (flags.delete && flags.olderThanDays < 1) {
    console.error("error: --older-than-days must be >= 1");
    process.exit(1);
  }
}

async function main() {
  loadDotenv();
  const flags = parseArgs(process.argv.slice(2));
  validateDeleteFlags(flags);

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
  console.log(`mode: ${flags.delete ? "delete" : "dry-run"}`);
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

  if (!flags.delete) {
    console.log("");
    console.log("dry-run only — no files deleted.");
    console.log("To reclaim disk after review: node scripts/ops/audit-storage.cjs --delete --older-than-days=90");
    return;
  }

  const cutoff = Date.now() - flags.olderThanDays * 24 * 60 * 60 * 1000;
  const deletable = orphans.filter((f) => f.mtimeMs < cutoff);
  let deleted = 0;
  let deletedBytes = 0;
  const skippedYoung = orphans.length - deletable.length;

  for (const item of deletable) {
    try {
      fs.unlinkSync(item.full);
      deleted += 1;
      deletedBytes += item.size;
    } catch (err) {
      console.error(`warn: could not delete ${item.rel}: ${err.message}`);
    }
  }

  console.log("");
  console.log("delete_summary:");
  console.log(`  older_than_days: ${flags.olderThanDays}`);
  console.log(`  deleted_files: ${deleted}`);
  console.log(`  deleted_bytes: ${deletedBytes} (${formatBytes(deletedBytes)})`);
  console.log(`  skipped_young_orphans: ${skippedYoung}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
