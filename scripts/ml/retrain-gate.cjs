/**
 * MLOps gate: when enough new feedback is still pending export (or optional: staged count),
 * notify Slack and/or POST a retraining webhook.
 *
 * Usage:
 *   node scripts/ml/retrain-gate.cjs
 *
 * Env:
 *   RETRAIN_FEEDBACK_THRESHOLD — default 1000 (pending rows in feedback_ingest)
 *   RETRAIN_WEBHOOK_URL — optional POST JSON { event, pendingCount, threshold }
 *   SLACK_WEBHOOK_URL — optional Slack incoming webhook for alerts
 *   ML_ALERT_EMAIL — optional (not implemented; use webhook to Zapier/email)
 *   POSTGRES_*
 *
 * CI: run on a schedule (see .github/workflows/ml-retrain-gate.yml).
 */
const { Pool } = require("pg");
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

loadDotenv();

async function postJson(url, body) {
  const u = new URL(url);
  const lib = u.protocol === "https:" ? require("https") : require("http");
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: `${u.pathname}${u.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () =>
          res.statusCode && res.statusCode >= 200 && res.statusCode < 300
            ? resolve(buf)
            : reject(new Error(`Webhook ${res.statusCode}: ${buf.slice(0, 200)}`))
        );
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function slackNotify(text, extra) {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return;
  await postJson(url, {
    text,
    ...extra
  });
}

async function main() {
  const threshold = Number(
    process.env.RETRAIN_FEEDBACK_THRESHOLD ??
      process.env.RETRAIN_THRESHOLD ??
      1000
  );
  if (!Number.isFinite(threshold) || threshold < 1) {
    console.error("Invalid RETRAIN_FEEDBACK_THRESHOLD");
    process.exit(1);
  }

  const host = process.env.POSTGRES_HOST || "";
  const user = process.env.POSTGRES_USER || "";
  const database = process.env.POSTGRES_DATABASE || "";
  if (!host || !user || !database) {
    console.error("Missing POSTGRES_* env");
    process.exit(1);
  }

  const pool = new Pool({
    host,
    port: Number(process.env.POSTGRES_PORT || 5432),
    user,
    password: process.env.POSTGRES_PASSWORD || "",
    database,
    connectionTimeoutMillis: 8000
  });

  const res = await pool.query(
    `SELECT COUNT(*)::int AS c FROM feedback_ingest WHERE exported_at IS NULL`
  );
  const pending = Number(res.rows[0]?.c ?? 0);
  await pool.end();

  console.log(`Pending feedback rows (not exported): ${pending} (threshold ${threshold})`);

  if (pending < threshold) {
    return;
  }

  const payload = {
    event: "retrain_threshold_reached",
    pendingCount: pending,
    threshold,
    ts: new Date().toISOString()
  };

  const webhook = process.env.RETRAIN_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      await postJson(webhook, payload);
      console.log("Retrain webhook invoked.");
    } catch (e) {
      console.error("Retrain webhook failed:", e.message);
      try {
        await slackNotify(
          `:x: Retrain webhook failed for AgriHome (${e.message})`
        );
      } catch (_) {}
      process.exit(1);
    }
  }

  try {
    await slackNotify(
      `:rocket: AgriHome ML: pending feedback *${pending}* reached threshold *${threshold}*. ${webhook ? "Webhook fired." : "Set RETRAIN_WEBHOOK_URL to trigger training."}`
    );
  } catch (e) {
    console.error("Slack notify failed:", e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
