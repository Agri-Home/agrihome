# AgriHome Vision Console

Full-stack **Next.js** monitoring UI for tray- and plant-level crop health: camera frames, simulated vision / health scoring, reports, meshes, and capture schedules. Runs out of the box on **mock data**; switch to **PostgreSQL** and **Qdrant** when you wire infrastructure.

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, mobile-first shell (sidebar + bottom nav) |
| Charts | Recharts (client-mounted frames for SSR safety) |
| API | REST route handlers + **GraphQL Yoga** (`POST /api/graphql`) |
| Data (optional) | **PostgreSQL** (`pg`), schema in `db/schema.sql` |
| Vectors (optional) | **Qdrant** for similarity-style matches |
| PWA | Service worker + install flow |

## Features

- **Overview** (`/`) — Latest frame, tray list, chart snapshot.
- **Trays** — List, tray detail (image, monitoring chart, plants with thumbnails, events).
- **Plants** — Detail: last image, health trend, reports, monitoring log.
- **Add plant** (`/plants/new`) — Photo-first flow: **auto species/cultivar** (simulated from image bytes) + **health report** (`POST /api/plants/from-photo`).
- **Mesh** — Group trays; mesh detail with merged activity and plants.
- **Schedule** — Capture intervals for trays or meshes.
- **Standalone build** — `output: "standalone"`; `postbuild` copies static assets into `.next/standalone` for container runs.

## Data mode: mock vs database

| Setting | Behavior |
|---------|----------|
| **`NEXT_PUBLIC_USE_MOCK_DATA`** not `false` (default in app logic) | In-memory **mock store** seeded from `src/lib/mocks/data.ts`. |
| **`NEXT_PUBLIC_USE_MOCK_DATA=false`** + **`POSTGRES_*`** set | Reads/writes **PostgreSQL** where implemented; many paths **fall back to mock** if a query throws. |

See `.env.example` for variables (including legacy `MARIADB_*` aliases read by `src/lib/config/env.ts`).

## Local setup

1. Copy `.env.example` to `.env` / `.env.local` and adjust.
2. `npm install`
3. `npm run dev` → [http://localhost:3000](http://localhost:3000)
4. Production build: `npm run build` then `npm start` (or `npm run start:standalone` after build for the standalone server from repo root).

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md) | Scope, architecture pointers, REST/GraphQL, schema, env, roadmap |
| [docs/diagrams/README.md](docs/diagrams/README.md) | **Mermaid** diagrams: architecture, integrations, UML-style domain/services, use cases |

## API routes (REST)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | API / DB / vector / pipeline flags |
| GET | `/api/camera/latest` | `?trayId=` optional |
| POST | `/api/camera/ingest` | JSON body — frame metadata |
| GET | `/api/predictions/latest` | `?trayId=` optional |
| GET | `/api/monitoring/log` | `limit`, `trayId`, `plantId` |
| GET | `/api/trays` | All tray systems |
| GET | `/api/plants` | `?trayId=` optional |
| POST | `/api/plants/manual` | JSON — create plant by name/cultivar |
| POST | `/api/plants/from-photo` | Multipart `photo` — auto ID + report |
| POST | `/api/plants/[plantId]/photo` | Multipart `photo` — analyze existing plant |
| GET | `/api/reports` | `trayId`, `plantId`, `limit` |
| GET/POST | `/api/mesh` | List / create mesh |
| GET/PATCH | `/api/schedules` | List / upsert schedules |
| POST | `/api/graphql` | GraphQL |

## GraphQL example

```graphql
query Snapshot {
  traySystems {
    id
    name
    healthScore
    status
  }
  latestImage(trayId: "tray-basil-01") {
    imageUrl
    capturedAt
  }
  monitoringLog(limit: 5, plantId: "tray-basil-01-plant-1") {
    level
    message
    createdAt
  }
}
```

## Scripts

- `npm run dev` — development server  
- `npm run build` — production build (+ `postbuild` standalone asset copy)  
- `npm run start` — `next start`  
- `npm run start:standalone` — `node .next/standalone/server.js` (from repo root, after build)  
- `npm run lint` — ESLint (flat config)  
- `npm run typecheck` — `tsc --noEmit`

## License / status

Internal / project-specific; ML and hardware paths are **simulated** until you replace `plant-detection-service`, prediction derivation, and camera ingest with production services.
