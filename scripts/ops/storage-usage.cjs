#!/usr/bin/env node
/**
 * Report originals storage usage (file count and bytes). No paths are printed.
 *
 * Usage:
 *   node scripts/ops/storage-usage.cjs
 *
 * Env: STORAGE_ROOT / STORAGE_ORIGINALS_DIR, optional STORAGE_QUOTA_BYTES
 */
const fs = require("fs");
const path = require("path");

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

function walkFiles(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, onFile);
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      const stat = fs.statSync(full);
      onFile(stat.size);
    } catch {
      // skip
    }
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

function main() {
  loadDotenv();
  const root = originalsRoot();
  let fileCount = 0;
  let bytesTotal = 0;

  if (fs.existsSync(root)) {
    walkFiles(root, (size) => {
      fileCount += 1;
      bytesTotal += size;
    });
  }

  const quotaRaw = process.env.STORAGE_QUOTA_BYTES?.trim();
  const quotaBytes = quotaRaw ? Number(quotaRaw) : null;
  const utilizationPercent =
    quotaBytes && Number.isFinite(quotaBytes) && quotaBytes > 0
      ? Math.min(100, Math.round((bytesTotal / quotaBytes) * 1000) / 10)
      : null;

  console.log("AgriHome originals storage usage");
  console.log(`file_count: ${fileCount}`);
  console.log(`bytes_total: ${bytesTotal} (${formatBytes(bytesTotal)})`);
  if (quotaBytes) {
    console.log(`quota_bytes: ${quotaBytes} (${formatBytes(quotaBytes)})`);
    console.log(`utilization_percent: ${utilizationPercent}`);
    console.log(`alert_threshold_percent: 80`);
    if (utilizationPercent !== null && utilizationPercent >= 80) {
      console.log("status: WARN — usage at or above 80% of quota");
    } else {
      console.log("status: ok");
    }
  } else {
    console.log("quota_bytes: (not configured — set STORAGE_QUOTA_BYTES to enable utilization alerts)");
    console.log("alert_threshold_percent: 80");
    console.log("status: ok");
  }
}

main();
