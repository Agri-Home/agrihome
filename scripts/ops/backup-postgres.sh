#!/usr/bin/env bash
# Backup AgriHome PostgreSQL to a timestamped custom-format dump (pg_dump -Fc).
#
# Defaults target the TrueNAS / Dockge deployment:
#   container: agrihome-postgres
#   output:    /mnt/mainpool/backups/agrihome/agrihome-YYYYMMDD-HHMMSS.dump
#
# Environment overrides:
#   AGRIHOME_POSTGRES_CONTAINER  Docker container name (default: agrihome-postgres)
#   AGRIHOME_BACKUP_DIR          Output directory (default: /mnt/mainpool/backups/agrihome)
#   POSTGRES_USER                Database user (default: agrihome)
#   POSTGRES_DATABASE            Database name (default: agrihome)
#
# Schedule examples — see docs/ops/BACKUP_AND_RESTORE.md

set -euo pipefail

CONTAINER="${AGRIHOME_POSTGRES_CONTAINER:-agrihome-postgres}"
BACKUP_DIR="${AGRIHOME_BACKUP_DIR:-/mnt/mainpool/backups/agrihome}"
POSTGRES_USER="${POSTGRES_USER:-agrihome}"
POSTGRES_DATABASE="${POSTGRES_DATABASE:-agrihome}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Load .env from repo root when present (Dockge stack dir or checkout).
if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
  POSTGRES_USER="${POSTGRES_USER:-agrihome}"
  POSTGRES_DATABASE="${POSTGRES_DATABASE:-agrihome}"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/agrihome-${TIMESTAMP}.dump"
TEMP_FILE="${OUTPUT_FILE}.partial"

mkdir -p "${BACKUP_DIR}"

if ! docker ps --format '{{.Names}}' | grep -Fxq "${CONTAINER}"; then
  echo "error: postgres container not running: ${CONTAINER}" >&2
  exit 1
fi

echo "Backing up ${POSTGRES_DATABASE} from ${CONTAINER} -> ${OUTPUT_FILE}"

docker exec "${CONTAINER}" pg_dump \
  -U "${POSTGRES_USER}" \
  -Fc \
  "${POSTGRES_DATABASE}" > "${TEMP_FILE}"

mv "${TEMP_FILE}" "${OUTPUT_FILE}"

BYTES="$(wc -c < "${OUTPUT_FILE}" | tr -d ' ')"
echo "ok: wrote ${OUTPUT_FILE} (${BYTES} bytes)"
