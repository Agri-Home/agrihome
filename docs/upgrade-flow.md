# AgriHome Upgrade and Rollback Flow

## Application container

1. Push code to `main` or `master`.
2. GitHub Actions runs typecheck, lint, optional tests, the Next.js build, and a Docker build.
3. If the quality gate passes, the image is pushed to GHCR with branch, SHA, and `latest` tags.
4. Watchtower updates only the labeled `agrihome` container.
5. Run `scripts/verify-stack.sh` and review logs.

## PostgreSQL and Qdrant

Stateful services are upgraded manually.

1. Back up PostgreSQL and create a Qdrant snapshot.
2. Record the currently running image tags or digests.
3. Review the vendor upgrade notes. Do not skip required intermediate versions.
4. Change `POSTGRES_IMAGE_TAG` or `QDRANT_IMAGE_TAG` in `.env`.
5. Redeploy with Dockge or Docker Compose.
6. Run health checks and inspect logs.
7. Roll back to the recorded image tag if validation fails.

## Validation commands

```bash
docker compose -f docker-compose.full-stack.yml ps
curl -fsS 'http://localhost:3000/api/health?ready=1' | jq .
curl -fsS http://localhost:8765/health | jq .
docker logs agrihome --tail 100
docker logs agrihome-postgres --tail 50
docker logs agrihome-qdrant --tail 50
docker logs plant-classifier --tail 50
```
