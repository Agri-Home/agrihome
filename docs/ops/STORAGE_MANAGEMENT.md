# Storage management (originals and processed)

Operators manage leaf images on disk separately from PostgreSQL backups. This runbook covers monthly audits, safe cleanup, usage monitoring, and thumbnails for list views.

## Layout

| Kind | Env | Served at |
|------|-----|-----------|
| Originals | `STORAGE_ORIGINALS_DIR` or `STORAGE_ROOT/originals` | `GET /api/files/originals/...` |
| Processed (thumbnails) | `STORAGE_PROCESSED_DIR` or `STORAGE_ROOT/processed` | `GET /api/files/processed/...` |

Database references:

- `plants.last_image_url`
- `camera_captures.image_url`
- `feedback_ingest.image_url` and `feedback_ingest.image_storage_key`

## Monthly process (recommended)

Run on the TrueNAS host (or any machine with access to the originals volume and Postgres):

### 1. Check usage

```bash
node scripts/ops/storage-usage.cjs
```

Or query the app health endpoint (no auth required for ops on internal network):

```bash
curl -s https://agrihome.tech/api/health | jq '.data.optional.storage'
```

Set `STORAGE_QUOTA_BYTES` in `.env` to the ZFS dataset quota (bytes). Alert when utilization reaches **80%** — wire this to your monitoring stack or review manually each month.

### 2. Dry-run audit

```bash
node scripts/ops/audit-storage.cjs
```

Review:

- `total_files` / `referenced_on_disk` / `orphan_candidates`
- `largest_orphan_candidates` — confirm nothing unexpected before cleanup

**Read-only by default.** No files are deleted unless both flags are supplied.

### 3. Age-gated cleanup (optional)

Only after reviewing the dry-run:

```bash
node scripts/ops/audit-storage.cjs --delete --older-than-days=90
```

Rules:

- **Both** `--delete` and `--older-than-days=N` are required.
- Supplying only one flag exits with an error.
- Deletes **orphan** files only (not referenced in Postgres).
- Orphans newer than `N` days are skipped.

Schedule example (first Sunday of the month, dry-run logged; cleanup is manual):

```cron
0 6 1-7 * 0 [ "$(date +\%u)" = 7 ] && cd /mnt/mainpool/apps/agrihome && node scripts/ops/audit-storage.cjs >> /var/log/agrihome-storage-audit.log 2>&1
```

## Thumbnails (grower-facing)

On upload, the app writes a 256px JPEG thumbnail under `processed/` mirroring the originals path (`.jpg` extension). Tray and mesh list views request the processed URL and fall back to the original if the thumbnail is missing.

## Application abstraction

Upload code uses `StorageProvider` (`put`, `getUrl`, `delete`) with `LocalStorageProvider` today. A future S3/MinIO backend can implement the same interface without changing callers.

## Related

- Database backup/restore: [BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md)
- Feedback storage paths: [../FEEDBACK_AND_RECLASSIFICATION.md](../FEEDBACK_AND_RECLASSIFICATION.md)
