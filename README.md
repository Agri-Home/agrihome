# AgriHome Vision Console

A full-stack Next.js monitoring dashboard prepared for a future hardware camera module.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Atomic design component structure
- PostgreSQL adapter for production metadata storage
- GraphQL API for consolidated read access
- Qdrant vector-search adapter for image-recognition similarity lookup
- Mock camera, prediction, and monitoring data so the app runs before ML integration is ready

## Features

- Dashboard with latest camera image, auto-refresh, manual refresh, and empty placeholder handling
- Multi-tray monitoring with tray-specific health views
- Individual plant monitoring, diagnosis reporting, and analytics inside each tray
- Mesh creation for grouping trays/systems into shared monitoring topologies
- Editable image-capture schedules for trays and meshes
- REST endpoints for latest image, latest prediction, monitoring history, and camera ingest
- GraphQL endpoint for dashboard and integrator queries
- Monitoring timeline for device health, alerts, and inference output
- Database schema stub for trays, plants, captures, reports, schedules, and events

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Open `http://localhost:3000`.

## Documentation

- Implementation guide: [docs/IMPLEMENTATION_GUIDE.md](/Users/laxmanbhusal/agrihome/docs/IMPLEMENTATION_GUIDE.md)

## API routes

- `GET /api/camera/latest`
- `POST /api/camera/ingest`
- `GET /api/predictions/latest`
- `GET /api/monitoring/log`
- `GET /api/trays`
- `GET /api/plants`
- `GET /api/reports`
- `GET /api/schedules`
- `POST /api/schedules`
- `PATCH /api/schedules`
- `GET /api/mesh`
- `POST /api/mesh`
- `POST /api/graphql`
- `GET /api/health`

## GraphQL example

```graphql
query DashboardSnapshot {
  latestImage {
    id
    deviceId
    capturedAt
    imageUrl
  }
  latestPrediction {
    id
    label
    confidence
    recommendation
  }
  monitoringLog(limit: 5) {
    id
    level
    message
    createdAt
  }
}
```

## Notes

- The workspace did not contain a Figma export or completed SRS data, so the current UI is a polished first-pass dashboard aligned to the chartered camera and ML workflow.
- The app can run against PostgreSQL and Qdrant using the environment variables in `.env.example`; mock mode is controlled by `NEXT_PUBLIC_USE_MOCK_DATA`.
