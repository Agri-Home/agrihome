# AgriHome Vision Console Implementation Guide

## 1. Purpose

This document describes what has been implemented so far in the AgriHome Vision Console, how the current system is structured, which APIs are available, and what the most important next enhancements should be.

The current application is a full-stack monitoring console for a plant-health platform: **PostgreSQL** holds core domain data, optional **Qdrant** backs similarity search, and optional HTTP services provide **tray** and **leaf** computer vision. Hardware cameras and production ML can replace simulated or derived prediction paths over time.

**Diagrams (Mermaid):** [docs/diagrams/README.md](./diagrams/README.md) — architecture, integrations, UML-style domain/services, and use cases.

## 2. Current Scope

Implemented so far:

- A Next.js App Router application with TypeScript and Tailwind CSS
- A mobile-first Vision Console UI: overview, tray drill-down, plant detail (stats, photo upload, edit/delete, charts, reports, log), mesh, schedules, and photo-first “add plant”
- Multi-tray monitoring backed by **PostgreSQL** (required for core reads/writes)
- Tray-specific live image, prediction, monitoring, and **tray CV** (plant count + boxes via `POST /api/trays/{trayId}/vision`)
- Individual plant tracking within trays
- Plant-level diagnosis reports covering disease and deficiency detection
- Editable image-capture schedules for trays and meshes
- Mesh creation to group trays/systems into monitoring topologies
- REST API routes for camera, prediction, monitoring, trays, tray vision, plants (CRUD + photos), files, mesh, health, schedules, and GraphQL
- GraphQL Yoga endpoint for reads and mutations (`createMeshNetwork`, `updatePlant`, `deletePlant`, `upsertSchedule`)
- PostgreSQL pool and SQL schema (`src/lib/db/postgres.ts`, `db/schema.sql`); optional `db/migrations/*.sql` for existing databases
- Qdrant-ready vector-search abstraction (optional)
- Optional remote **species** classifier (`CV_SPECIES_INFERENCE_URL`) and **tray** detector (`CV_TRAY_INFERENCE_URL`); tray vision can use a simulator when the tray URL is unset
- GitHub Actions workflow for Docker image release after successful validation (including manual `workflow_dispatch`)

Not fully implemented yet:

- Real hardware camera ingestion from deployed devices
- Real ML model inference pipeline
- Hardening for all edge cases (transactions, idempotency, partial failures)
- Real vector embeddings and full image-recognition pipeline
- Authentication, authorization, and multi-user operations
- Mesh visualization and mesh-level orchestration logic

## 3. High-Level Architecture

Visual overview: [docs/diagrams/01-architecture.md](./diagrams/01-architecture.md).

### Frontend

- Root layout: [src/app/layout.tsx](../src/app/layout.tsx) — `PwaProvider`, `AppShell` (sidebar desktop, bottom nav mobile).
- Shell: [src/components/shell/AppShell.tsx](../src/components/shell/AppShell.tsx).
- Routes (App Router):
  - Overview: [src/app/page.tsx](../src/app/page.tsx)
  - Trays: [src/app/trays/page.tsx](../src/app/trays/page.tsx), [src/app/trays/[trayId]/page.tsx](../src/app/trays/[trayId]/page.tsx)
  - Plants: [src/app/plants/[plantId]/page.tsx](../src/app/plants/[plantId]/page.tsx), [src/app/plants/new/](../src/app/plants/new/) (photo-first add + auto species + health report)
  - Mesh: [src/app/mesh/page.tsx](../src/app/mesh/page.tsx), [src/app/mesh/[meshId]/page.tsx](../src/app/mesh/[meshId]/page.tsx)
  - Schedule: [src/app/schedule/page.tsx](../src/app/schedule/page.tsx)
- Charts (Recharts, client-only framing): [src/components/charts/](../src/components/charts/), [src/components/media/PlantImage.tsx](../src/components/media/PlantImage.tsx) (uploads vs optimized images).
- Design system: [src/components/atoms/](../src/components/atoms/), [src/components/app/](../src/components/app/), [src/app/globals.css](../src/app/globals.css).

### Backend

REST API routes (representative):

- Camera: [src/app/api/camera/latest/route.ts](../src/app/api/camera/latest/route.ts), [src/app/api/camera/ingest/route.ts](../src/app/api/camera/ingest/route.ts)
- Predictions: [src/app/api/predictions/latest/route.ts](../src/app/api/predictions/latest/route.ts)
- Monitoring: [src/app/api/monitoring/log/route.ts](../src/app/api/monitoring/log/route.ts)
- Topology: [src/app/api/trays/route.ts](../src/app/api/trays/route.ts), [src/app/api/trays/[trayId]/vision/route.ts](../src/app/api/trays/[trayId]/vision/route.ts), [src/app/api/mesh/route.ts](../src/app/api/mesh/route.ts)
- Plants & reports: [src/app/api/plants/route.ts](../src/app/api/plants/route.ts), [src/app/api/plants/manual/route.ts](../src/app/api/plants/manual/route.ts), [src/app/api/plants/from-photo/route.ts](../src/app/api/plants/from-photo/route.ts), [src/app/api/plants/[plantId]/route.ts](../src/app/api/plants/[plantId]/route.ts), [src/app/api/plants/[plantId]/photo/route.ts](../src/app/api/plants/[plantId]/photo/route.ts), [src/app/api/reports/route.ts](../src/app/api/reports/route.ts)
- Stored files: [src/app/api/files/[...path]/route.ts](../src/app/api/files/[...path]/route.ts)
- Schedules: [src/app/api/schedules/route.ts](../src/app/api/schedules/route.ts)
- Health & GraphQL: [src/app/api/health/route.ts](../src/app/api/health/route.ts), [src/app/api/graphql/route.ts](../src/app/api/graphql/route.ts)

Service layer:

- Camera, prediction, monitoring, topology, plant, schedule, vector — under [src/lib/services/](../src/lib/services/)
- Manual / photo flows: [src/lib/services/plant-manual-service.ts](../src/lib/services/plant-manual-service.ts), [src/lib/services/plant-detection-service.ts](../src/lib/services/plant-detection-service.ts) (HTTP client for `CV_SPECIES_INFERENCE_URL`; throws if unconfigured)
- File persistence: [src/lib/storage/](../src/lib/storage/) (originals on disk; URLs often under `/api/files/...`)

### Persistence and infrastructure

- PostgreSQL pool: [src/lib/db/postgres.ts](../src/lib/db/postgres.ts) (env also accepts legacy `MARIADB_*` names as aliases in [src/lib/config/env.ts](../src/lib/config/env.ts))
- GraphQL schema: [src/lib/graphql/schema.ts](../src/lib/graphql/schema.ts)
- Environment: [src/lib/config/env.ts](../src/lib/config/env.ts)
- Domain types: [src/lib/types/domain.ts](../src/lib/types/domain.ts)
- SQL: [db/schema.sql](../db/schema.sql)

## 4. Implemented Functional Areas

### 4.1 Vision Console UI

- **Home (`/`)** — Latest frame (when available), tray list, summary chart.
- **Trays** — List and **tray detail** with latest image, monitoring area chart, plant rows (thumbnails), monitoring events, **tray vision** upload (count + detection boxes when configured).
- **Plants** — **Plant detail** with hero stats, latest finding, **photo upload**, **edit** (name, species/cultivar, description), **delete**, health line chart, report history, monitoring log (plant-scoped, falls back to tray events when empty).
- **Add plant (`/plants/new`)** — Tray picker, single photo upload; **species/cultivar from remote classifier** + **health report** via `POST /api/plants/from-photo` (requires **`CV_SPECIES_INFERENCE_URL`**).
- **Mesh** — List, create form, **mesh detail** with merged monitoring chart and plant list.
- **Schedule** — List/edit capture schedules (tray or mesh scope).
- **PWA** — Service worker + install hints via `PwaProvider`.

### 4.2 Camera Flow

Current behavior:

- `GET /api/camera/latest` returns the latest camera frame
- Optional `trayId` query parameter scopes the response to one tray
- `POST /api/camera/ingest` accepts a new frame for a tray
- Captures are written through the service layer to **PostgreSQL** (and linked storage paths as implemented)

### 4.3 Prediction Flow

Current behavior:

- `GET /api/predictions/latest` returns the latest prediction
- Optional `trayId` query parameter scopes the prediction to one tray
- Predictions are produced from the prediction service (placeholders or derived from captures/reports depending on configuration)
- Similar-image matches are returned through the vector-service abstraction
- When Qdrant is configured, similarity matches are served from the collection; otherwise the UI receives an empty list

### 4.4 Monitoring Flow

Current behavior:

- `GET /api/monitoring/log` returns event history
- Supports `limit`, optional `trayId`, optional `plantId`
- Events represent hardware, prediction, and environmental states
- The UI uses these events to show tray-level operational detail

### 4.5 Tray and Mesh Topology

Current behavior:

- `GET /api/trays` returns all tray systems
- `GET /api/mesh` returns all meshes
- `POST /api/mesh` creates a mesh linking at least two trays
- The mesh model is currently a logical grouping for monitoring and future orchestration

This is the current meaning of a mesh in the system:

- A mesh is a named network of trays/systems
- It can later represent alert routing, irrigation coordination, topology-aware diagnostics, or hardware node relationships

### 4.6 Individual Plant Reporting

Current behavior:

- `GET /api/plants` returns plant units for a tray or the whole system
- `GET /api/reports` returns plant-level reports
- Each plant has its own health score, latest diagnosis, and last report timestamp
- Each report can include disease candidates, deficiencies, anomalies, summary text, and recommended action

### 4.7 Scheduled Imaging

Current behavior:

- `GET /api/schedules` returns capture schedules
- `POST /api/schedules` creates a schedule
- `PATCH /api/schedules` updates a schedule
- Schedules can target either a tray or a mesh
- The current destination is modeled as the future computer-vision backend

## 5. Domain Model

Key entities from [domain.ts](../src/lib/types/domain.ts):

### TraySystem

- `id`
- `name`
- `zone`
- `crop`
- `plantCount` (catalog count in AgriHome)
- `visionPlantCount`, `visionPlantCountAt`, `visionPlantCountConfidence`, `visionDetections` (optional; from tray CV — see `db/migrations/001_tray_vision.sql` if upgrading)
- `healthScore`
- `status`
- `deviceId`
- `lastCaptureAt`

### CameraCapture

- `id`
- `trayId`
- `trayName`
- `deviceId`
- `imageUrl`
- `capturedAt`
- `source`
- `status`
- `notes`

### PredictionResult

- `id`
- `captureId`
- `trayId`
- `label`
- `confidence`
- `severity`
- `recommendation`
- `vectorSource`
- `createdAt`
- `similarMatches`

### MonitoringEvent

- `id`
- `captureId`
- `trayId`
- `level`
- `title`
- `message`
- `createdAt`

### MeshNetwork

- `id`
- `name`
- `trayIds`
- `nodeCount`
- `status`
- `createdAt`
- `summary`

### PlantUnit

- `id`
- `trayId`
- `meshIds`
- `name`
- `cultivar`
- `description` (optional user notes — see `db/migrations/002_plant_description.sql` if upgrading)
- `slotLabel`
- `row`
- `column`
- `healthScore`
- `status`
- `lastReportAt`
- `latestDiagnosis`
- `lastImageUrl` (nullable)
- `lastImageAt`

### PlantReport

- `id`
- `trayId`
- `plantId`
- `captureId`
- `diagnosis`
- `confidence`
- `severity`
- `diseases`
- `deficiencies`
- `anomalies`
- `summary`
- `recommendedAction`
- `status`
- `createdAt`

### CaptureSchedule

- `id`
- `scopeType`
- `scopeId`
- `name`
- `intervalMinutes`
- `active`
- `nextRunAt`
- `lastRunAt`
- `destination`

## 6. REST API Documentation

### 6.1 Health

`GET /api/health`

Purpose:

- Returns current API, database, vector store, and camera pipeline state

Example response:

```json
{
  "data": {
    "api": "healthy",
    "database": "connected",
    "vectorStore": "disconnected",
    "cameraPipeline": "simulated",
    "trayVisionInference": "simulated",
    "speciesInference": "unconfigured"
  },
  "generatedAt": "2026-04-02T20:00:00.000Z"
}
```

`database` is `connected` or `disconnected` (PostgreSQL ping). `vectorStore` is `connected` when `QDRANT_URL` is set and used, else `disconnected`. `trayVisionInference` is `remote` when `CV_TRAY_INFERENCE_URL` is set, else `simulated`. `speciesInference` is `remote` when `CV_SPECIES_INFERENCE_URL` is set, else `unconfigured`.

### 6.2 Latest Camera Image

`GET /api/camera/latest`

Query params:

- `trayId` optional

Purpose:

- Returns the latest image for the whole system or for one tray

Example:

`GET /api/camera/latest?trayId=tray-basil-01`

### 6.3 Camera Ingest

`POST /api/camera/ingest`

Required body:

```json
{
  "trayId": "tray-basil-01",
  "trayName": "Basil Tray A1",
  "deviceId": "cam-greenhouse-01",
  "imageUrl": "/images/test-image.jpg",
  "capturedAt": "2026-04-02T20:00:00.000Z",
  "notes": "Frame accepted from edge device."
}
```

Purpose:

- Simulates or accepts a hardware image upload event

Current behavior:

- Writes through the camera service to **PostgreSQL** (and associated storage where applicable)

### 6.4 Latest Prediction

`GET /api/predictions/latest`

Query params:

- `trayId` optional

Purpose:

- Returns the latest prediction for the whole system or a selected tray

Example:

`GET /api/predictions/latest?trayId=tray-basil-01`

### 6.5 Monitoring Log

`GET /api/monitoring/log`

Query params:

- `limit` optional, default `10`
- `trayId` optional
- `plantId` optional (scopes events to one plant)

Purpose:

- Returns recent monitoring events

Examples:

- `GET /api/monitoring/log?limit=8`
- `GET /api/monitoring/log?trayId=tray-basil-01&limit=8`
- `GET /api/monitoring/log?plantId=tray-basil-01-plant-1&limit=8`

### 6.6 Tray List

`GET /api/trays`

Purpose:

- Returns all tray systems available to the dashboard

### 6.7 Tray vision (plant count + boxes)

`POST /api/trays/{trayId}/vision`

- `multipart/form-data`: field `photo` (file).
- Persists optional CV fields on the tray (`vision_plant_count`, detections JSON, etc.). Uses remote HTTP when `CV_TRAY_INFERENCE_URL` is set; otherwise a built-in simulator.

### 6.8 Mesh List

`GET /api/mesh`

Purpose:

- Returns all defined mesh networks

### 6.9 Mesh Create

`POST /api/mesh`

Required body:

```json
{
  "name": "North rack supervision mesh",
  "trayIds": ["tray-basil-01", "tray-tomato-02"]
}
```

Validation rules:

- `name` is required
- at least two `trayIds` are required

Purpose:

- Creates a new mesh network for grouped tray monitoring

### 6.10 Plants

`GET /api/plants`

Query params:

- `trayId` optional

Purpose:

- Returns individual plants for a tray or for all trays

### 6.11 Create plant (manual JSON)

`POST /api/plants/manual`

Body (JSON):

```json
{
  "name": "Kitchen basil",
  "cultivar": "Ocimum basilicum 'Genovese'",
  "trayId": "tray-manual"
}
```

- Creates a plant row in **PostgreSQL**. Tray defaults to `tray-manual` (“My plants”) when omitted.

### 6.12 Create plant from photo (auto species + health report)

`POST /api/plants/from-photo`

- `multipart/form-data`: field `photo` (file), optional `trayId`, optional `displayName`, optional `cultivar` override.
- Calls **`CV_SPECIES_INFERENCE_URL`** (`detectPlantSpeciesFromImage`), creates the plant, stores the image via the storage layer, ingests capture, generates prediction + plant report.

### 6.13 Update or delete plant

`PATCH /api/plants/{plantId}`

- JSON body: any of `name`, `cultivar`, `description` (`null` clears description). At least one field required.

`DELETE /api/plants/{plantId}`

- Removes the plant (implementation-defined cascade for reports/captures).

### 6.14 Analyze existing plant photo

`POST /api/plants/{plantId}/photo`

- `multipart/form-data`: field `photo` (file).
- Attaches image and runs health analysis for an existing plant.

### 6.15 Serve stored files

`GET /api/files/{...path}`

- Serves files from the configured storage roots (originals / processed / temp). Used by `next/image` `localPatterns` and upload URLs.

### 6.16 Plant Reports

`GET /api/reports`

Query params:

- `trayId` optional
- `plantId` optional
- `limit` optional, default `12`

Purpose:

- Returns plant-level diagnostic reports, including disease and deficiency information

### 6.17 Capture Schedules

`GET /api/schedules`

Query params:

- `scopeType` optional, `tray` or `mesh`
- `scopeId` optional

`POST /api/schedules`

Required body:

```json
{
  "scopeType": "tray",
  "scopeId": "tray-basil-01",
  "name": "Basil daylight scan",
  "intervalMinutes": 120,
  "active": true
}
```

`PATCH /api/schedules`

Required body:

```json
{
  "id": "schedule-tray-basil",
  "scopeType": "tray",
  "scopeId": "tray-basil-01",
  "name": "Basil daylight scan",
  "intervalMinutes": 90,
  "active": true
}
```

Purpose:

- Manages editable schedules that drive future image capture and CV backend submission

## 7. GraphQL API Documentation

Endpoint:

- `POST /api/graphql`

Schema source:

- [src/lib/graphql/schema.ts](../src/lib/graphql/schema.ts)

### Supported Queries

- `latestImage(trayId: String)`
- `latestPrediction(trayId: String)`
- `monitoringLog(limit: Int, trayId: String, plantId: String)`
- `traySystems`
- `meshNetworks`
- `plants(trayId: String)`
- `reports(trayId: String, plantId: String, limit: Int)`
- `schedules(scopeType: String, scopeId: String)`
- `health`

### Supported Mutations

- `createMeshNetwork(name: String!, trayIds: [String!]!)`
- `updatePlant(plantId: ID!, name: String, cultivar: String, description: String): PlantUnit!`
- `deletePlant(plantId: ID!): Boolean!`
- `upsertSchedule(id: String, scopeType: String!, scopeId: String!, name: String!, intervalMinutes: Int!, active: Boolean!)`

### Example Query

```graphql
query TraySnapshot {
  traySystems {
    id
    name
    status
    healthScore
  }
  latestImage(trayId: "tray-basil-01") {
    id
    trayName
    deviceId
    imageUrl
  }
  latestPrediction(trayId: "tray-basil-01") {
    label
    confidence
    severity
    recommendation
  }
  monitoringLog(limit: 5, trayId: "tray-basil-01") {
    id
    level
    title
    message
  }
}
```

### Example mutations

```graphql
mutation CreateMesh {
  createMeshNetwork(
    name: "North rack supervision mesh"
    trayIds: ["tray-basil-01", "tray-tomato-02"]
  ) {
    id
    name
    nodeCount
    status
  }
}
```

```graphql
mutation RenamePlant {
  updatePlant(plantId: "tray-basil-01-plant-1", name: "Basil A", description: "Bench 2") {
    id
    name
    cultivar
    description
  }
}
```

## 8. Database Documentation

Current SQL schema:

- `tray_systems`
- `plants`
- `camera_captures`
- `prediction_results`
- `plant_reports`
- `monitoring_events`
- `mesh_networks`
- `capture_schedules`

Schema file:

- [db/schema.sql](../db/schema.sql)

Important current design notes:

- `tray_systems` is the parent entity for tray-level monitoring (includes optional **tray CV** columns: `vision_plant_count`, timestamps, confidence, `vision_detections_json`)
- `plants` stores individual monitored plants inside trays (includes optional `description` for user notes)
- `camera_captures` references trays
- `prediction_results` references both captures and trays
- `plant_reports` stores plant-level diagnosis output
- `monitoring_events` can optionally reference both captures and trays
- `mesh_networks` stores grouped tray IDs in JSON
- `capture_schedules` defines automated capture cadence for trays and meshes

## 9. Environment and runtime configuration

Configuration source:

- [src/lib/config/env.ts](../src/lib/config/env.ts)

Important variables (see `.env.example`):

- **`POSTGRES_HOST`**, **`POSTGRES_PORT`**, **`POSTGRES_USER`**, **`POSTGRES_PASSWORD`**, **`POSTGRES_DATABASE`** — required for normal operation (`requirePostgresPool()` throws if the core trio host/user/database is missing)
- Legacy aliases still read in [env.ts](../src/lib/config/env.ts): `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DATABASE`
- **`QDRANT_URL`**, **`QDRANT_API_KEY`**, **`QDRANT_COLLECTION`** — optional vector store
- **`CV_TRAY_INFERENCE_URL`**, **`CV_TRAY_INFERENCE_API_KEY`** — optional tray detector
- **`CV_SPECIES_INFERENCE_URL`**, **`CV_SPECIES_INFERENCE_API_KEY`** — required for code paths that call `detectPlantSpeciesFromImage` (add plant from photo, etc.)
- **`STORAGE_ROOT`** / related — optional; defaults under repo `storage/` (see `.env.example`)

Current runtime behavior:

- Listing and mutating trays, plants, meshes, schedules, and related entities goes through **PostgreSQL**
- When Qdrant is not configured, similarity search returns empty results and health reports `vectorStore: disconnected`
- Tray vision uses a **remote** HTTP model when `CV_TRAY_INFERENCE_URL` is set, otherwise a **simulated** count/boxes path

## 10. Docker and Release Automation

Files:

- Dockerfile: [Dockerfile](../Dockerfile)
- Workflow: [docker-release.yml](../.github/workflows/docker-release.yml)

Current pipeline behavior:

- Triggered on push to `main` or `master`, or manually via **`workflow_dispatch`**
- Runs `npm ci`
- Runs `npm run typecheck`
- Runs `npm run build`
- If validation succeeds, builds and pushes a container image to GHCR

Image tagging:

- commit SHA
- branch name
- `latest` on the default branch

## 11. What is production-ready vs still evolving

Reasonably ready:

- Next.js application structure
- App shell and drill-down monitoring UI (trays, plants, mesh, schedules)
- REST and GraphQL endpoint shape
- Service-layer separation
- PostgreSQL-backed domain model and SQL schema
- CI/CD release workflow for container publishing

Still partial or environment-dependent:

- Production-grade ML, embeddings, and Qdrant hygiene at scale
- Hardware camera streaming and transport
- Rich mesh topology management beyond list/create/detail
- Security hardening
- Auditability and observability

## 12. Recommended Further Enhancements

### Immediate

- Add authentication and role-based access control
- Add request validation with a schema library such as Zod
- Add API error normalization and structured error responses
- Add unit and integration tests for services and API routes
- Add frontend loading skeletons and optimistic mesh creation feedback

### Hardware Integration

- Define a real ingest contract for edge devices
- Support binary upload or object-storage URLs for camera images
- Add device registration and tray-to-device provisioning
- Track device heartbeat and offline/online transitions

### ML and Recognition

- Implement real image embedding generation
- Store embeddings and metadata in Qdrant
- Add prediction history instead of only latest prediction
- Add confidence thresholds and human-review states
- Support disease classes, anomaly regions, and treatment workflows

### Mesh and Topology

- Add mesh topology graph / node visualization beyond the current mesh detail page
- Add tray-to-tray link visualization
- Add mesh-level aggregate health scoring
- Add mesh alert propagation rules
- Add routing and automation policies per mesh

### Operations

- Add audit logging
- Add observability with metrics and structured logs
- Add rate limiting
- Add environment-based deploy targets
- Add staged release promotion beyond simple image publishing

## 13. Suggested Next Milestones

### Milestone 1

- Route validation (e.g. Zod) and normalized API errors
- Test coverage for API routes and services
- Broader operational monitoring

### Milestone 2

- Real camera ingest pipeline
- Object storage for image assets
- Device and tray registration model

### Milestone 3

- Real ML inference service
- Qdrant-backed recognition
- Prediction history and review workflows

### Milestone 4

- Mesh topology visualization
- Mesh-level analytics and automation
- User accounts and operational roles

## 14. Summary

The system now provides a working full-stack foundation for:

- tray-specific plant-health monitoring
- live image retrieval and placeholder handling
- prediction and monitoring event presentation
- mesh creation for grouped tray systems
- Docker-based release automation

The application is already structured in a way that makes future hardware, ML, and persistence integration realistic without forcing a rewrite of the UI or API surface.
