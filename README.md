# AgriHome Vision Console

A full-stack Next.js monitoring dashboard prepared for a future hardware camera module.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS
- Atomic design component structure
- MariaDB adapter for production metadata storage
- GraphQL API for consolidated read access
- Qdrant vector-search adapter for image-recognition similarity lookup
- Mock camera, prediction, and monitoring data so the app runs before ML integration is ready

## Features

- Dashboard with latest camera image, auto-refresh, manual refresh, and empty placeholder handling
- Multi-tray monitoring with tray-specific health views
- Mesh creation for grouping trays/systems into shared monitoring topologies
- REST endpoints for latest image, latest prediction, monitoring history, and camera ingest
- GraphQL endpoint for dashboard and integrator queries
- Monitoring timeline for device health, alerts, and inference output
- Database schema stub for camera captures, predictions, and events

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Open `http://localhost:3000`.

## API routes

- `GET /api/camera/latest`
- `POST /api/camera/ingest`
- `GET /api/predictions/latest`
- `GET /api/monitoring/log`
- `GET /api/trays`
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
- The app defaults to mock data and can be switched to MariaDB and Qdrant using environment variables and the schema in `db/schema.sql`.
