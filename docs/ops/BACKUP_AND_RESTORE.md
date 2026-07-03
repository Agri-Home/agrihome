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

## Restore (quick reference)

**Stop writes first:**

```bash
docker stop agrihome
```

**Restore into the running Postgres container** (destructive — replaces objects in target DB):

```bash
BACKUP=/mnt/mainpool/backups/agrihome/agrihome-20260702-020001.dump
docker exec -i agrihome-postgres pg_restore \
  -U agrihome \
  -d agrihome \
  --clean \
  --if-exists \
  < "${BACKUP}"
```

Or copy dump into container:

```bash
docker cp "${BACKUP}" agrihome-postgres:/tmp/restore.dump
docker exec agrihome-postgres pg_restore -U agrihome -d agrihome --clean --if-exists /tmp/restore.dump
docker start agrihome
```

Verify:

```bash
curl -s http://localhost:3000/api/health?ready=1
docker exec agrihome-postgres psql -U agrihome -d agrihome -c 'SELECT COUNT(*) FROM plants;'
```

See also [Database Scaling and High Availability](../confluence/03-database-scaling-and-high-availability.md).

---

## Related documents

- [DevOps and Infrastructure](../confluence/04-devops-and-infrastructure.md)
- [Database Scaling and High Availability](../confluence/03-database-scaling-and-high-availability.md)
