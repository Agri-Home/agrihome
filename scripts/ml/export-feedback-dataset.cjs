/**
 * Export pending feedback_ingest rows into a staging folder for model training.
 *
 * - Reads Postgres rows where exported_at IS NULL (up to --limit).
 * - Copies local images from storage/originals/{image_storage_key} or downloads S3 / HTTPS URLs.
 * - Writes manifest.jsonl (one JSON object per line) with normalized text fields.
 * - Marks rows exported with a shared export_batch_id.
 *
 * Usage:
 *   node scripts/ml/export-feedback-dataset.cjs
 *   node scripts/ml/export-feedback-dataset.cjs --limit 500
 *
 * Env: POSTGRES_*, STORAGE_ROOT / STORAGE_ORIGINALS_DIR (for files on disk),
 *      PUBLIC_API_BASE_URL (optional, to download /api/files/... URLs),
 *      ML_STAGING_DIR (default: ./storage/ml-staging)
 *      PLANTVILLAGE_FEEDBACK_DATASET_DIR (optional; fallback if originals path missing but
 *      plantvillage_dataset_relpath is set)
 */
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const https = require("https");
const http = require("http");

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

loadDotenv();

function originalsRoot() {
  const explicit = process.env.STORAGE_ORIGINALS_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  const sr = process.env.STORAGE_ROOT?.trim();
  if (sr) return path.resolve(sr, "originals");
  return path.join(rootDir, "storage", "originals");
}

function normalizeText(s) {
  if (!s || typeof s !== "string") return "";
  return s.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function mapCategory(raw, mapObj) {
  const n = normalizeText(raw).toLowerCase();
  if (mapObj && typeof mapObj === "object" && mapObj[n]) {
    return mapObj[n];
  }
  return n.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unknown";
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const f = fs.createWriteStream(destPath);
    lib
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          f.close();
          fs.unlink(destPath, () => {});
          if (!loc) return reject(new Error("Redirect without location"));
          return resolve(downloadToFile(new URL(loc, url).href, destPath));
        }
        if (res.statusCode !== 200) {
          f.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(f);
        f.on("finish", () => f.close((e) => (e ? reject(e) : resolve())));
      })
      .on("error", (err) => {
        f.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

async function main() {
  const limitArg = process.argv.includes("--limit")
    ? Number(process.argv[process.argv.indexOf("--limit") + 1])
    : 2000;
  const limit = Number.isFinite(limitArg) ? Math.min(10000, limitArg) : 2000;

  const host = process.env.POSTGRES_HOST || "";
  const user = process.env.POSTGRES_USER || "";
  const database = process.env.POSTGRES_DATABASE || "";
  if (!host || !user || !database) {
    console.error("Missing POSTGRES_HOST, POSTGRES_USER, or POSTGRES_DATABASE");
    process.exit(1);
  }

  let labelMap = {};
  const mapJson = process.env.ML_LABEL_MAP_JSON?.trim();
  if (mapJson) {
    try {
      labelMap = JSON.parse(mapJson);
    } catch {
      console.warn("ML_LABEL_MAP_JSON invalid JSON — ignoring.");
    }
  }

  const stagingRoot =
    process.env.ML_STAGING_DIR?.trim() ||
    path.join(rootDir, "storage", "ml-staging");
  const batchId = `batch-${Date.now()}`;
  const batchDir = path.join(stagingRoot, "batches", batchId);
  const imagesDir = path.join(batchDir, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  const pool = new Pool({
    host,
    port: Number(process.env.POSTGRES_PORT || 5432),
    user,
    password: process.env.POSTGRES_PASSWORD || "",
    database,
    connectionTimeoutMillis: 8000
  });

  const res = await pool.query(
    `SELECT id, image_url, image_storage_provider, image_storage_key,
            feedback_category, feedback_tags, comment_text, model_prediction_label,
            owner_email, user_uid, created_at, plantvillage_dataset_relpath
     FROM feedback_ingest
     WHERE exported_at IS NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  const rows = res.rows;
  if (rows.length === 0) {
    console.log("No pending feedback rows.");
    await pool.end();
    return;
  }

  const manifestPath = path.join(batchDir, "manifest.jsonl");
  const manifestStream = fs.createWriteStream(manifestPath, { flags: "a" });
  const origRoot = originalsRoot();
  const plantVillageRoot = process.env.PLANTVILLAGE_FEEDBACK_DATASET_DIR?.trim()
    ? path.resolve(process.env.PLANTVILLAGE_FEEDBACK_DATASET_DIR.trim())
    : null;
  const publicBase = (
    process.env.PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/+$/, "");

  const exportedIds = [];

  for (const r of rows) {
    const extGuess = (() => {
      const u = r.image_url || "";
      if (u.includes(".png")) return "png";
      if (u.includes(".webp")) return "webp";
      return "jpg";
    })();
    const localName = `${r.id}.${extGuess}`;
    const imagePath = path.join(imagesDir, localName);

    try {
      if (
        r.image_storage_provider === "local" &&
        r.image_storage_key
      ) {
        const abs = path.join(origRoot, r.image_storage_key);
        if (fs.existsSync(abs)) {
          fs.copyFileSync(abs, imagePath);
        } else if (
          plantVillageRoot &&
          r.plantvillage_dataset_relpath
        ) {
          const pva = path.join(plantVillageRoot, r.plantvillage_dataset_relpath);
          if (fs.existsSync(pva)) {
            fs.copyFileSync(pva, imagePath);
          } else {
            throw new Error(`Missing file ${abs} and ${pva}`);
          }
        } else {
          throw new Error(`Missing file ${abs}`);
        }
      } else if (r.image_url && r.image_url.startsWith("/api/files/")) {
        const url = `${publicBase}${r.image_url}`;
        await downloadToFile(url, imagePath);
      } else if (r.image_url?.startsWith("http")) {
        await downloadToFile(r.image_url, imagePath);
      } else {
        throw new Error("Cannot resolve image source");
      }
    } catch (e) {
      console.error(`Skip ${r.id}:`, e.message);
      continue;
    }

    exportedIds.push(r.id);

    let tags = r.feedback_tags;
    if (typeof tags === "string") {
      try {
        tags = JSON.parse(tags);
      } catch {
        tags = [];
      }
    }
    if (!Array.isArray(tags)) tags = [];

    const record = {
      id: r.id,
      image_rel_path: `images/${localName}`,
      plantvillage_dataset_relpath: r.plantvillage_dataset_relpath || null,
      user_uid: r.user_uid,
      owner_email: r.owner_email,
      created_at: new Date(r.created_at).toISOString(),
      feedback_category_raw: normalizeText(r.feedback_category),
      feedback_category_label: mapCategory(r.feedback_category, labelMap),
      tags: tags.map((t) => normalizeText(String(t))).filter(Boolean),
      comment: normalizeText(r.comment_text),
      model_prediction_label: normalizeText(r.model_prediction_label)
    };

    manifestStream.write(`${JSON.stringify(record)}\n`);
  }

  manifestStream.end();
  await new Promise((res) => manifestStream.on("finish", res));

  if (exportedIds.length > 0) {
    await pool.query(
      `UPDATE feedback_ingest
       SET exported_at = CURRENT_TIMESTAMP, export_batch_id = $1
       WHERE id = ANY($2::varchar[])`,
      [batchId, exportedIds]
    );
  }

  await pool.end();

  console.log(
    `Wrote ${exportedIds.length} rows to ${batchDir} (batch ${batchId})`
  );
  fs.writeFileSync(
    path.join(stagingRoot, "latest_batch.txt"),
    `${batchId}\n`,
    "utf8"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
