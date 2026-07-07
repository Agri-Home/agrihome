#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.full-stack.yml}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://localhost:3000/api/health?ready=1}"
CLASSIFIER_HEALTH_URL="${CLASSIFIER_HEALTH_URL:-http://localhost:8765/health}"

echo "== Container status =="
docker compose -f "$COMPOSE_FILE" ps

echo "== AgriHome readiness =="
curl -fsS "$APP_HEALTH_URL"
echo

echo "== Classifier health =="
curl -fsS "$CLASSIFIER_HEALTH_URL"
echo

echo "Stack verification passed."
