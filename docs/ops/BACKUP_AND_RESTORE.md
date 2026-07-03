# PostgreSQL backup and restore

Operational guide for AgriHome logical backups on TrueNAS (Dockge + Docker).

---

## Backup script

**Path:** `scripts/ops/backup-postgres.sh`

Creates a timestamped **custom-format** dump:

```
/mnt/mainpool/backups/agrihome/agrihome-20260702-020001.dump
```

### Manual run

From the host (TrueNAS shell or SSH):

```bash
cd /path/to/agrihome
chmod +x scripts/ops/backup-postgres.sh
./scripts/ops/backup-postgres.sh
```

With overrides:

```bash
AGRIHOME_BACKUP_DIR=/mnt/mainpool/backups/agrihome \
POSTGRES_USER=agrihome \
POSTGRES_DATABASE=agrihome \
./scripts/ops/backup-postgres.sh
```

The script reads `POSTGRES_USER` and `POSTGRES_DATABASE` from `.env` in the repo root when present.

| Variable | Default |
|----------|---------|
| `AGRIHOME_POSTGRES_CONTAINER` | `agrihome-postgres` |
| `AGRIHOME_BACKUP_DIR` | `/mnt/mainpool/backups/agrihome` |
| `POSTGRES_USER` | `agrihome` |
| `POSTGRES_DATABASE` | `agrihome` |

### Prerequisites

- `docker` CLI on the host
- `agrihome-postgres` container running
- Write access to `AGRIHOME_BACKUP_DIR` (create dataset on TrueNAS if needed):

```bash
mkdir -p /mnt/mainpool/backups/agrihome
```

---

## Scheduling

Dockge does not run cron jobs itself — schedule the script on the **TrueNAS host** or a management VM with Docker socket access.

### TrueNAS cron (recommended)

**Tasks → Cron Jobs → Add**

| Field | Value |
|-------|-------|
| Command | `/path/to/agrihome/scripts/ops/backup-postgres.sh >> /var/log/agrihome-backup.log 2>&1` |
| Schedule | Daily at 02:00 |
| User | `root` |

Example crontab entry:

```cron
0 2 * * * /mnt/mainpool/apps/agrihome/repo/scripts/ops/backup-postgres.sh >> /var/log/agrihome-backup.log 2>&1
```

Adjust the script path to where the compose stack / git checkout lives on your NAS.

### Dockge-adjacent layout

Typical TrueNAS layout:

```
/mnt/mainpool/apps/agrihome/
  uploads/          # app storage volume
  postgres/         # postgres data
  repo/             # git checkout with scripts/ops/backup-postgres.sh and .env
```

Point cron at `repo/scripts/ops/backup-postgres.sh`. Keep `.env` beside `docker-compose.agrihome-stack.yml` so credentials match the running stack.

---

## Retention (operator policy)

The script does not prune old dumps. Suggested TrueNAS approach:

| Layer | Retention |
|-------|-----------|
| Daily dumps | 30 days (cron + manual `find … -mtime +30 -delete`) |
| ZFS snapshot of `mainpool/backups` | 90 days |
| Offsite copy | Weekly `rsync` or cloud sync |

Example prune (run weekly after backup):

```bash
find /mnt/mainpool/backups/agrihome -name 'agrihome-*.dump' -mtime +30 -delete
```

---

## Restore script

**Path:** `scripts/ops/restore-postgres.sh`

Guarded restore from a `pg_dump -Fc` file. **Requires explicit arguments** — it will not guess the target database or backup path.

| Flag | Required | Purpose |
|------|----------|---------|
| `--database NAME` | Yes | Target database to restore into |
| `--file PATH` | Yes | Backup `.dump` file |
| `--confirm` | Yes | Acknowledgment flag (no accidental runs) |
| `--allow-production` | No | Required only when restoring into production `agrihome` |

**Safety rules:**

- Refuses to run without `--database`, `--file`, and `--confirm`.
- Refuses to restore into the production database (`POSTGRES_DATABASE` from `.env`, default `agrihome`) unless `--allow-production` is set.
- Creates the target database if it does not exist (useful for disposable drills).

---

## Runbook: validate backup (disposable database)

Run monthly (or after changing backup cron) to prove a dump is restorable **without touching production data**.

### 1. Pick a backup file

```bash
ls -lt /mnt/mainpool/backups/agrihome/agrihome-*.dump | head
BACKUP=/mnt/mainpool/backups/agrihome/agrihome-20260702-020001.dump
```

### 2. Drop any previous drill database

```bash
docker exec agrihome-postgres psql -U agrihome -d postgres -c \
  "DROP DATABASE IF EXISTS agrihome_restore_test;"
```

### 3. Restore into disposable database

```bash
cd /path/to/agrihome
chmod +x scripts/ops/restore-postgres.sh

./scripts/ops/restore-postgres.sh \
  --database agrihome_restore_test \
  --file "${BACKUP}" \
  --confirm
```

The script creates `agrihome_restore_test` if missing, then runs `pg_restore --clean --if-exists`.

### 4. Verification queries

```bash
# Core tables exist and contain rows
docker exec agrihome-postgres psql -U agrihome -d agrihome_restore_test -c \
  "SELECT 'tray_systems' AS table, COUNT(*)::bigint AS rows FROM tray_systems
   UNION ALL SELECT 'plants', COUNT(*)::bigint FROM plants
   UNION ALL SELECT 'camera_captures', COUNT(*)::bigint FROM camera_captures
   UNION ALL SELECT 'plant_reports', COUNT(*)::bigint FROM plant_reports
   UNION ALL SELECT 'feedback_ingest', COUNT(*)::bigint FROM feedback_ingest
   ORDER BY table;"

# Spot-check latest plant report timestamp
docker exec agrihome-postgres psql -U agrihome -d agrihome_restore_test -c \
  "SELECT id, diagnosis, created_at FROM plant_reports ORDER BY created_at DESC LIMIT 5;"

# Confirm restore_test is isolated from production
docker exec agrihome-postgres psql -U agrihome -d postgres -c \
  "SELECT datname FROM pg_database WHERE datname IN ('agrihome', 'agrihome_restore_test');"
```

Expected: counts are non-negative; `agrihome` and `agrihome_restore_test` are separate databases.

### 5. Cleanup drill database

```bash
docker exec agrihome-postgres psql -U agrihome -d postgres -c \
  "DROP DATABASE IF EXISTS agrihome_restore_test;"
```

Record the backup filename and row counts in your ops log.

---

## Runbook: production restore

Use only when production data must be replaced from backup.

### 1. Stop writes

```bash
docker stop agrihome
```

### 2. Optional: take a fresh backup before overwrite

```bash
./scripts/ops/backup-postgres.sh
```

### 3. Restore with production guard

```bash
BACKUP=/mnt/mainpool/backups/agrihome/agrihome-20260702-020001.dump

./scripts/ops/restore-postgres.sh \
  --database agrihome \
  --file "${BACKUP}" \
  --confirm \
  --allow-production
```

### 4. Verify production

```bash
docker start agrihome

curl -s http://localhost:3000/api/health?ready=1

docker exec agrihome-postgres psql -U agrihome -d agrihome -c \
  "SELECT COUNT(*) AS plants FROM plants;"

docker exec agrihome-postgres psql -U agrihome -d agrihome -c \
  "SELECT COUNT(*) AS reports FROM plant_reports;"
```

### 5. Smoke test in UI

- Sign in at `https://agrihome.tech`
- Open dashboard and one plant detail page
- Confirm images load from `/api/files/...` (storage is separate from DB)

---

## Failure handling

| Symptom | Action |
|---------|--------|
| `refusing restore into production database` | Use disposable name for drills, or add `--allow-production` after stopping `agrihome` |
| `backup file not found` | Check path and ZFS snapshot mount |
| `pg_restore` errors on extension/owner | Script uses `--no-owner --no-acl`; re-run after Postgres container upgrade only if versions match |
| App healthy but empty UI | DB restored but `uploads` volume unchanged — expected if only DB was lost |

See also [Database Scaling and High Availability](../confluence/03-database-scaling-and-high-availability.md).

---

## Related documents

- [DevOps and Infrastructure](../confluence/04-devops-and-infrastructure.md)
- [Database Scaling and High Availability](../confluence/03-database-scaling-and-high-availability.md)
