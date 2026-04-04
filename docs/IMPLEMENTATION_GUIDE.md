# AgriHome Vision Console Implementation Guide

## 1. Purpose

This document describes what has been implemented so far in the AgriHome Vision Console, how the current system is structured, which APIs are available, and what the most important next enhancements should be.

The current application is a full-stack monitoring console for a future plant-health hardware platform. It is designed to work today with mock data and later switch to real hardware cameras, ML inference, PostgreSQL persistence, and vector-search-backed image recognition.

**Diagrams (Mermaid):** [docs/diagrams/README.md](./diagrams/README.md) — architecture, integrations, UML-style domain/services, and use cases.

## 2. Current Scope

Implemented so far:

- A Next.js App Router application with TypeScript and Tailwind CSS
- A mobile-first Vision Console UI: overview, tray drill-down, plant detail (charts, reports), mesh, schedules, and photo-first “add plant”
- Multi-tray monitoring
- Tray-specific live image, prediction, and monitoring views
- Individual plant tracking within trays
- Plant-level diagnosis reports covering disease and deficiency detection
- Editable image-capture schedules for trays and meshes
- Mesh creation to group trays/systems into monitoring topologies
- REST API routes for camera, prediction, monitoring, trays, mesh, health, and GraphQL
- GraphQL Yoga endpoint for read access and mesh creation
- PostgreSQL-ready service and schema layer (`src/lib/db/postgres.ts`)
- Qdrant-ready vector-search abstraction
- Mock-first data and simulation layer so the app works before hardware and ML integration are ready
- GitHub Actions workflow for Docker image release after successful validation

Not fully implemented yet:

- Real hardware camera ingestion from deployed devices
- Real ML model inference pipeline
- Persistent PostgreSQL writes for all flows in every edge case (some paths still mock-fallback on error)
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
- Topology: [src/app/api/trays/route.ts](../src/app/api/trays/route.ts), [src/app/api/mesh/route.ts](../src/app/api/mesh/route.ts)
- Plants & reports: [src/app/api/plants/route.ts](../src/app/api/plants/route.ts), [src/app/api/plants/manual/route.ts](../src/app/api/plants/manual/route.ts), [src/app/api/plants/from-photo/route.ts](../src/app/api/plants/from-photo/route.ts), [src/app/api/plants/[plantId]/photo/route.ts](../src/app/api/plants/[plantId]/photo/route.ts), [src/app/api/reports/route.ts](../src/app/api/reports/route.ts)
- Schedules: [src/app/api/schedules/route.ts](../src/app/api/schedules/route.ts)
- Health & GraphQL: [src/app/api/health/route.ts](../src/app/api/health/route.ts), [src/app/api/graphql/route.ts](../src/app/api/graphql/route.ts)

Service layer:

- Camera, prediction, monitoring, topology, plant, schedule, vector — under [src/lib/services/](../src/lib/services/)
- Manual / photo flows: [src/lib/services/plant-manual-service.ts](../src/lib/services/plant-manual-service.ts), [src/lib/services/plant-detection-service.ts](../src/lib/services/plant-detection-service.ts) (simulated species ID from image bytes)
- Mock: [src/lib/services/mock-store.ts](../src/lib/services/mock-store.ts), seed [src/lib/mocks/data.ts](../src/lib/mocks/data.ts)

### Persistence and infrastructure

- PostgreSQL pool: [src/lib/db/postgres.ts](../src/lib/db/postgres.ts) (env also accepts legacy `MARIADB_*` names as aliases in [src/lib/config/env.ts](../src/lib/config/env.ts))
- GraphQL schema: [src/lib/graphql/schema.ts](../src/lib/graphql/schema.ts)
- Environment: [src/lib/config/env.ts](../src/lib/config/env.ts)
- Domain types: [src/lib/types/domain.ts](../src/lib/types/domain.ts)
- SQL: [db/schema.sql](../db/schema.sql)

## 4. Implemented Functional Areas

### 4.1 Vision Console UI

- **Home (`/`)** — Latest frame (when available), tray list, summary chart.
- **Trays** — List and **tray detail** with latest image, monitoring area chart, plant rows (thumbnails), monitoring events.
- **Plants** — **Plant detail** with last image, health line chart (reports), monitoring log, report history.
- **Add plant (`/plants/new`)** — Tray picker, single photo upload; **auto species/cultivar** (simulated from image hash) + **health report** via `POST /api/plants/from-photo`.
- **Mesh** — List, create form, **mesh detail** with merged monitoring chart and plant list.
- **Schedule** — List/edit capture schedules (tray or mesh scope).
- **PWA** — Service worker + install hints via `PwaProvider`.

### 4.2 Camera Flow

Current behavior:

- `GET /api/camera/latest` returns the latest camera frame
- Optional `trayId` query parameter scopes the response to one tray
- `POST /api/camera/ingest` accepts a new frame for a tray
- If the app is running in mock mode, the data is stored in the in-memory mock store
- If PostgreSQL is configured and mock mode is disabled, captures are written to the database (with mock fallback on error)

### 4.3 Prediction Flow

Current behavior:

- `GET /api/predictions/latest` returns the latest prediction
- Optional `trayId` query parameter scopes the prediction to one tray
- Mock predictions are generated when the real ML model is not ready
- Similar-image matches are returned through the vector-service abstraction
- The app can later switch from mock similarity data to Qdrant

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
- `plantCount`
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
    "database": "mock",
    "vectorStore": "mock",
    "cameraPipeline": "simulated"
  },
  "generatedAt": "2026-04-02T20:00:00.000Z"
}
```

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

- Stores to mock store in mock mode
- Structured to write to PostgreSQL in live mode

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

Purpose:

- Returns recent monitoring events

Examples:

- `GET /api/monitoring/log?limit=8`
- `GET /api/monitoring/log?trayId=tray-basil-01&limit=8`

### 6.6 Tray List

`GET /api/trays`

Purpose:

- Returns all tray systems available to the dashboard

### 6.7 Mesh List

`GET /api/mesh`

Purpose:

- Returns all defined mesh networks

### 6.8 Mesh Create

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

### 6.9 Plants

`GET /api/plants`

Query params:

- `trayId` optional

Purpose:

- Returns individual plants for a tray or for all trays

### 6.10 Create plant (manual JSON)

`POST /api/plants/manual`

Body (JSON):

```json
{
  "name": "Kitchen basil",
  "cultivar": "Ocimum basilicum 'Genovese'",
  "trayId": "tray-manual"
}
```

- Creates a plant row (mock store or PostgreSQL). Tray defaults to `tray-manual` (“My plants”) when omitted.

### 6.11 Create plant from photo (auto species + health report)

`POST /api/plants/from-photo`

- `multipart/form-data`: field `photo` (file), optional `trayId`, optional `displayName`, optional `cultivar` override.
- Runs simulated species detection from image bytes, creates the plant, saves file under `public/uploads/plants/`, ingests capture, generates prediction + plant report.

### 6.12 Analyze existing plant photo

`POST /api/plants/{plantId}/photo`

- `multipart/form-data`: field `photo` (file).
- Attaches image and runs health analysis for an existing plant.

### 6.13 Plant Reports

`GET /api/reports`

Query params:

- `trayId` optional
- `plantId` optional
- `limit` optional, default `12`

Purpose:

- Returns plant-level diagnostic reports, including disease and deficiency information

### 6.14 Capture Schedules

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

### Supported Mutation

- `createMeshNetwork(name: String!, trayIds: [String!]!)`
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

### Example Mutation

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

- `tray_systems` is the parent entity for tray-level monitoring
- `plants` stores individual monitored plants inside trays
- `camera_captures` references trays
- `prediction_results` references both captures and trays
- `plant_reports` stores plant-level diagnosis output
- `monitoring_events` can optionally reference both captures and trays
- `mesh_networks` stores grouped tray IDs in JSON
- `capture_schedules` defines automated capture cadence for trays and meshes

## 9. Mock Mode vs Real Mode

Configuration source:

- [src/lib/config/env.ts](../src/lib/config/env.ts)

Important variables (see `.env.example`):

- `NEXT_PUBLIC_USE_MOCK_DATA` — default behavior in code treats unset as mock-friendly; set to `false` for DB-backed runs
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`
- Legacy aliases still read in [env.ts](../src/lib/config/env.ts): `MARIADB_HOST`, `MARIADB_PORT`, `MARIADB_USER`, `MARIADB_PASSWORD`, `MARIADB_DATABASE`
- `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`

Current runtime behavior:

- If mock mode is enabled, services read from the in-memory mock store
- If mock mode is disabled and PostgreSQL is configured, services attempt database access (many code paths fall back to mock on query failure)
- If Qdrant is configured, vector lookups can move from mock similarity matches to real vector search

## 10. Docker and Release Automation

Files:

- Dockerfile: [Dockerfile](../Dockerfile)
- Workflow: [docker-release.yml](../.github/workflows/docker-release.yml)

Current pipeline behavior:

- Triggered on push to `main` or `master`
- Runs `npm ci`
- Runs `npm run typecheck`
- Runs `npm run build`
- If validation succeeds, builds and pushes a container image to GHCR

Image tagging:

- commit SHA
- branch name
- `latest` on the default branch

## 11. What Is Production-Ready vs What Is Still Mocked

Reasonably ready:

- Next.js application structure
- App shell and drill-down monitoring UI (trays, plants, mesh, schedules)
- REST and GraphQL endpoint shape
- Service-layer separation
- Database schema direction
- CI/CD release workflow for container publishing

Still mocked or partial:

- ML classification logic
- Embedding generation
- Real Qdrant population and query strategy
- Hardware camera streaming and transport
- Persistent topology management for every code path (some still mock-fallback)
- Security hardening
- Auditability and observability

## 12. Recommended Further Enhancements

### Immediate

- Add authentication and role-based access control
- Persist trays, captures, predictions, events, and meshes fully in PostgreSQL without silent mock fallback
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

- Hardened PostgreSQL persistence (no silent fallback where inappropriate)
- Route validation
- Test coverage for API routes

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
