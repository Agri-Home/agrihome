# AgriHome Vision Console Implementation Guide

## 1. Purpose

This document describes what has been implemented so far in the AgriHome Vision Console, how the current system is structured, which APIs are available, and what the most important next enhancements should be.

The current application is a full-stack monitoring console for a future plant-health hardware platform. It is designed to work today with mock data and later switch to real hardware cameras, ML inference, MariaDB persistence, and vector-search-backed image recognition.

## 2. Current Scope

Implemented so far:

- A Next.js App Router application with TypeScript and Tailwind CSS
- A modern monitoring dashboard UI based on the `Plant Health Monitoring App` design direction
- Multi-tray monitoring
- Tray-specific live image, prediction, and monitoring views
- Individual plant tracking within trays
- Plant-level diagnosis reports covering disease and deficiency detection
- Editable image-capture schedules for trays and meshes
- Mesh creation to group trays/systems into monitoring topologies
- REST API routes for camera, prediction, monitoring, trays, mesh, health, and GraphQL
- GraphQL Yoga endpoint for read access and mesh creation
- MariaDB-ready service and schema layer
- Qdrant-ready vector-search abstraction
- Mock-first data and simulation layer so the app works before hardware and ML integration are ready
- GitHub Actions workflow for Docker image release after successful validation

Not fully implemented yet:

- Real hardware camera ingestion from deployed devices
- Real ML model inference pipeline
- Persistent MariaDB writes for tray systems, meshes, predictions, and monitoring in all flows
- Real vector embeddings and full image-recognition pipeline
- Authentication, authorization, and multi-user operations
- Mesh visualization and mesh-level orchestration logic

## 3. High-Level Architecture

### Frontend

Main UI:

- Dashboard page: [src/app/page.tsx](/Users/laxmanbhusal/agrihome/src/app/page.tsx)
- Main client template: [src/components/templates/DashboardTemplate.tsx](/Users/laxmanbhusal/agrihome/src/components/templates/DashboardTemplate.tsx)

Design system:

- Atoms: [src/components/atoms](/Users/laxmanbhusal/agrihome/src/components/atoms)
- Molecules: [src/components/molecules](/Users/laxmanbhusal/agrihome/src/components/molecules)
- Global styling: [src/app/globals.css](/Users/laxmanbhusal/agrihome/src/app/globals.css)

### Backend

REST API routes:

- [src/app/api/camera/latest/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/camera/latest/route.ts)
- [src/app/api/camera/ingest/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/camera/ingest/route.ts)
- [src/app/api/predictions/latest/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/predictions/latest/route.ts)
- [src/app/api/monitoring/log/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/monitoring/log/route.ts)
- [src/app/api/trays/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/trays/route.ts)
- [src/app/api/mesh/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/mesh/route.ts)
- [src/app/api/health/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/health/route.ts)
- [src/app/api/graphql/route.ts](/Users/laxmanbhusal/agrihome/src/app/api/graphql/route.ts)

Service layer:

- Camera service: [src/lib/services/camera-service.ts](/Users/laxmanbhusal/agrihome/src/lib/services/camera-service.ts)
- Prediction service: [src/lib/services/prediction-service.ts](/Users/laxmanbhusal/agrihome/src/lib/services/prediction-service.ts)
- Monitoring service: [src/lib/services/monitoring-service.ts](/Users/laxmanbhusal/agrihome/src/lib/services/monitoring-service.ts)
- Topology service: [src/lib/services/topology-service.ts](/Users/laxmanbhusal/agrihome/src/lib/services/topology-service.ts)
- Plant service: [src/lib/services/plant-service.ts](/Users/laxmanbhusal/agrihome/src/lib/services/plant-service.ts)
- Schedule service: [src/lib/services/schedule-service.ts](/Users/laxmanbhusal/agrihome/src/lib/services/schedule-service.ts)
- Vector service: [src/lib/services/vector-service.ts](/Users/laxmanbhusal/agrihome/src/lib/services/vector-service.ts)
- Mock store: [src/lib/services/mock-store.ts](/Users/laxmanbhusal/agrihome/src/lib/services/mock-store.ts)

### Persistence and Infrastructure

- MariaDB connection pool: [src/lib/db/mariadb.ts](/Users/laxmanbhusal/agrihome/src/lib/db/mariadb.ts)
- GraphQL schema: [src/lib/graphql/schema.ts](/Users/laxmanbhusal/agrihome/src/lib/graphql/schema.ts)
- Environment config: [src/lib/config/env.ts](/Users/laxmanbhusal/agrihome/src/lib/config/env.ts)
- Domain models: [src/lib/types/domain.ts](/Users/laxmanbhusal/agrihome/src/lib/types/domain.ts)
- SQL schema: [db/schema.sql](/Users/laxmanbhusal/agrihome/db/schema.sql)

## 4. Implemented Functional Areas

### 4.1 Dashboard UI

The dashboard currently supports:

- Tray selection for monitoring one tray/system at a time
- Live image display for the selected tray
- Auto-refresh and manual refresh
- Placeholder state if the selected tray has no current image
- Latest prediction result with severity and recommendation
- Plant-level health cards inside each tray
- Plant-level diagnosis reports including disease candidates, deficiencies, and recommended action
- Editable tray capture schedule management
- Similar image references from the vector-search layer
- Monitoring log scoped to the selected tray
- Mesh creation, mesh listing, and mesh-oriented schedule management

### 4.2 Camera Flow

Current behavior:

- `GET /api/camera/latest` returns the latest camera frame
- Optional `trayId` query parameter scopes the response to one tray
- `POST /api/camera/ingest` accepts a new frame for a tray
- If the app is running in mock mode, the data is stored in the in-memory mock store
- If MariaDB is configured and mock mode is disabled, the service is structured to write to the database

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
- Supports `limit` and optional `trayId`
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

Key entities from [domain.ts](/Users/laxmanbhusal/agrihome/src/lib/types/domain.ts):

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
- Structured to write to MariaDB in real mode

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

### 6.10 Plant Reports

`GET /api/reports`

Query params:

- `trayId` optional
- `plantId` optional
- `limit` optional, default `12`

Purpose:

- Returns plant-level diagnostic reports, including disease and deficiency information

### 6.11 Capture Schedules

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

- [src/lib/graphql/schema.ts](/Users/laxmanbhusal/agrihome/src/lib/graphql/schema.ts)

### Supported Queries

- `latestImage(trayId: String)`
- `latestPrediction(trayId: String)`
- `monitoringLog(limit: Int, trayId: String)`
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

- [db/schema.sql](/Users/laxmanbhusal/agrihome/db/schema.sql)

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

- [src/lib/config/env.ts](/Users/laxmanbhusal/agrihome/src/lib/config/env.ts)

Important variables:

- `NEXT_PUBLIC_USE_MOCK_DATA`
- `MARIADB_HOST`
- `MARIADB_PORT`
- `MARIADB_USER`
- `MARIADB_PASSWORD`
- `MARIADB_DATABASE`
- `QDRANT_URL`
- `QDRANT_API_KEY`
- `QDRANT_COLLECTION`

Current runtime behavior:

- If mock mode is enabled, services read from the in-memory mock store
- If mock mode is disabled and MariaDB is configured, services attempt database access
- If Qdrant is configured, vector lookups can move from mock similarity matches to real vector search

## 10. Docker and Release Automation

Files:

- Dockerfile: [Dockerfile](/Users/laxmanbhusal/agrihome/Dockerfile)
- Workflow: [docker-release.yml](/Users/laxmanbhusal/agrihome/.github/workflows/docker-release.yml)

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
- Dashboard shell and tray-aware monitoring UI
- REST and GraphQL endpoint shape
- Service-layer separation
- Database schema direction
- CI/CD release workflow for container publishing

Still mocked or partial:

- ML classification logic
- Embedding generation
- Real Qdrant population and query strategy
- Hardware camera streaming and transport
- Persistent topology management beyond mock-first flows
- Security hardening
- Auditability and observability

## 12. Recommended Further Enhancements

### Immediate

- Add authentication and role-based access control
- Persist trays, captures, predictions, events, and meshes fully in MariaDB
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

- Add a mesh detail page
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

- Real MariaDB persistence
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
