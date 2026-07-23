/**
 * AGRI-105: advance due raspberry-pi-edge capture schedules.
 * Run via cron, e.g. every minute:
 *   * * * * * cd /path/to/agrihome && node scripts/capture-schedule-runner.cjs
 *
 * Enqueues capture_now commands for linked edge devices; the Pi agent
 * executes move → dwell → capture → ingest per pose.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const rootDir = path.join(__dirname, "..");

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
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

function loadEnv() {
  for (const file of [".env", ".env.local"]) {
    const parsed = parseEnvFile(path.join(rootDir, file));
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

async function main() {
  loadEnv();
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE
  });
  await client.connect();

  try {
    const due = await client.query(
      `SELECT id, owner_email, scope_type, scope_id, interval_minutes, name
       FROM capture_schedules
       WHERE active = TRUE
         AND destination = 'raspberry-pi-edge'
         AND next_run_at <= NOW()`
    );

    let enqueued = 0;
    for (const row of due.rows) {
      let trayIds = [];
      if (row.scope_type === "tray") {
        trayIds = [row.scope_id];
      } else {
        const mesh = await client.query(
          `SELECT tray_ids FROM mesh_networks WHERE id = $1 AND owner_email = $2`,
          [row.scope_id, row.owner_email]
        );
        const raw = mesh.rows[0]?.tray_ids;
        trayIds = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? JSON.parse(raw)
            : [];
      }

      for (const trayId of trayIds) {
        const tray = await client.query(
          `SELECT edge_device_id FROM tray_systems
           WHERE id = $1 AND owner_email = $2`,
          [trayId, row.owner_email]
        );
        const deviceId = tray.rows[0]?.edge_device_id;
        if (!deviceId) continue;

        const cmdId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        await client.query(
          `INSERT INTO edge_device_commands
            (id, device_id, tray_id, command_type, payload_json, status)
           VALUES ($1,$2,$3,'capture_now',$4::json,'pending')`,
          [
            cmdId,
            deviceId,
            trayId,
            JSON.stringify({
              scheduleId: row.id,
              scheduleName: row.name,
              runPoses: true
            })
          ]
        );
        enqueued += 1;
      }

      await client.query(
        `UPDATE capture_schedules
         SET last_run_at = NOW(),
             next_run_at = NOW() + ($2::text || ' minutes')::interval
         WHERE id = $1`,
        [row.id, String(row.interval_minutes)]
      );
    }

    console.log(
      JSON.stringify({
        ok: true,
        due: due.rowCount,
        enqueued,
        at: new Date().toISOString()
      })
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
