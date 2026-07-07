# DevOps and Infrastructure

## Current deployment

AgriHome is deployed on a TrueNAS server and managed through Dockge using `docker-compose.full-stack.yml`. The Compose project contains the logical `agrihome-core` services (`agrihome`, PostgreSQL, Qdrant, and Watchtower) and the logical `agrihome-ai` services (`plant-classifier` and `plant-trainer`). Persistent data is stored on the TrueNAS ZFS pool rather than inside disposable containers.

## CI/CD

The GitHub Actions workflow in `.github/workflows/docker-release.yml` runs a quality gate with dependency installation, TypeScript checking, linting, optional tests, the production application build, and a Docker image build. On non-pull-request pushes, the workflow publishes branch, SHA, and `latest` tags to GHCR. Watchtower updates only the labeled AgriHome application container. PostgreSQL, Qdrant, the classifier, and the trainer remain manual updates.

## Monitoring

The application exposes `/api/health` for liveness and `/api/health?ready=1` for readiness. Readiness checks PostgreSQL connectivity, while the health payload reports vector and CV inference configuration. Docker healthchecks are configured for the application, PostgreSQL, and classifier. Dockge container status and Docker logs are used for troubleshooting. Run `scripts/verify-stack.sh` after deployments.

## Secrets

Real secrets are stored in `.env` on the server and are excluded from Git. `.env.example` and `.env.ai.example` document required variables without including production credentials.

## Upgrade policy

Application updates may be automated through Watchtower after the CI quality gate passes. Stateful service upgrades require backups, pinned versions, health validation, and a rollback plan. See `docs/upgrade-flow.md`.
