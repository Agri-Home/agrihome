#!/usr/bin/env bash
# Restore AgriHome PostgreSQL from a pg_dump -Fc file.
#
# Safety: requires explicit --database and --file, plus --confirm.
# Refuses to overwrite the production database unless --allow-production is set.
#
# Drill example:
#   ./scripts/ops/restore-postgres.sh \
#     --database agrihome_restore_test \
#     --file /mnt/mainpool/backups/agrihome/agrihome-20260702-020001.dump \
#     --confirm
#
# See docs/ops/BACKUP_AND_RESTORE.md

set -euo pipefail

CONTAINER="${AGRIHOME_POSTGRES_CONTAINER:-agrihome-postgres}"
POSTGRES_USER="${POSTGRES_USER:-agrihome}"
PRODUCTION_DATABASE="${POSTGRES_DATABASE:-agrihome}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
  POSTGRES_USER="${POSTGRES_USER:-agrihome}"
  PRODUCTION_DATABASE="${POSTGRES_DATABASE:-agrihome}"
fi

TARGET_DATABASE=""
BACKUP_FILE=""
CONFIRM=false
ALLOW_PRODUCTION=false

usage() {
  cat <<EOF
Usage: $(basename "$0") --database NAME --file PATH --confirm [options]

Required:
  --database NAME   Target PostgreSQL database name
  --file PATH       Custom-format dump from backup-postgres.sh (pg_dump -Fc)
  --confirm         Acknowledge restore will modify the target database

Options:
  --allow-production  Allow restore into production DB (${PRODUCTION_DATABASE})
  --container NAME    Docker container (default: ${CONTAINER})
  --user NAME         PostgreSQL user (default: ${POSTGRES_USER})

Environment:
  AGRIHOME_POSTGRES_CONTAINER, POSTGRES_USER, POSTGRES_DATABASE

Example (disposable drill):
  $(basename "$0") --database agrihome_restore_test \\
    --file /mnt/mainpool/backups/agrihome/agrihome-20260702-020001.dump \\
    --confirm
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --database)
      TARGET_DATABASE="${2:-}"
      shift 2
      ;;
    --file)
      BACKUP_FILE="${2:-}"
      shift 2
      ;;
    --confirm)
      CONFIRM=true
      shift
      ;;
    --allow-production)
      ALLOW_PRODUCTION=true
      shift
      ;;
    --container)
      CONTAINER="${2:-}"
      shift 2
      ;;
    --user)
      POSTGRES_USER="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${TARGET_DATABASE}" || -z "${BACKUP_FILE}" ]]; then
  echo "error: --database and --file are required" >&2
  usage >&2
  exit 1
fi

if [[ ! "${TARGET_DATABASE}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "error: invalid database name: ${TARGET_DATABASE}" >&2
  exit 1
fi

if [[ "${CONFIRM}" != true ]]; then
  echo "error: --confirm is required to run a restore" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "error: backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ "${TARGET_DATABASE}" == "${PRODUCTION_DATABASE}" && "${ALLOW_PRODUCTION}" != true ]]; then
  echo "error: refusing restore into production database '${PRODUCTION_DATABASE}'" >&2
  echo "       use a disposable database for drills, or pass --allow-production after stopping the app" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -Fxq "${CONTAINER}"; then
  echo "error: postgres container not running: ${CONTAINER}" >&2
  exit 1
fi

echo "restore target : ${TARGET_DATABASE}"
echo "backup file    : ${BACKUP_FILE}"
echo "container      : ${CONTAINER}"
echo "user           : ${POSTGRES_USER}"

if ! docker exec "${CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${TARGET_DATABASE}'" | grep -q 1; then
  echo "creating database ${TARGET_DATABASE}"
  docker exec "${CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres -c \
    "CREATE DATABASE \"${TARGET_DATABASE}\";"
fi

REMOTE_DUMP="/tmp/agrihome-restore-$$.dump"
cleanup() {
  docker exec "${CONTAINER}" rm -f "${REMOTE_DUMP}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "copying dump into ${CONTAINER}:${REMOTE_DUMP}"
docker cp "${BACKUP_FILE}" "${CONTAINER}:${REMOTE_DUMP}"

echo "running pg_restore (this may take a minute)..."
docker exec "${CONTAINER}" pg_restore \
  -U "${POSTGRES_USER}" \
  -d "${TARGET_DATABASE}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "${REMOTE_DUMP}"

echo "ok: restored ${BACKUP_FILE} -> ${TARGET_DATABASE}"
