# AgriHome Vision Console

Full-stack **Next.js** monitoring UI for tray- and plant-level crop health: camera frames, CV-assisted counts and species ID, reports, meshes, and capture schedules. **PostgreSQL** is **required** for trays, plants, captures, and related APIs; **Qdrant** and remote CV URLs are optional extras.

## Stack

| Layer | Choice |
|-------|--------|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, mobile-first shell (sidebar + bottom nav) |
| Charts | Recharts (client-mounted frames for SSR safety) |
| API | REST route handlers + **GraphQL Yoga** (`POST /api/graphql`) |
| Data | **PostgreSQL** (`pg`) — schema in `db/schema.sql`; use `npm run db:schema` / `npm run db:seed` |
| Auth | **Firebase Authentication** (email/password + Google) + server-verified session cookies |
| Vectors (optional) | **Qdrant** for similarity search when `QDRANT_URL` is set |
| File storage | Uploads under configurable `STORAGE_*` paths; served via **`GET /api/files/...`** (see `.env.example`) |
| PWA | Service worker + install flow |

## Features

- **Dashboard** (`/`) — Latest frame, tray list, chart snapshot (page title: “Overview”).
- **Authentication** (`/login`) — Firebase email/password and Google sign-in; authenticated app pages use an HTTP-only Firebase session cookie.
- **Trays** — List, tray detail (image, monitoring chart, plants with thumbnails, events). **Tray CV**: upload a top-down photo for **plant count + instance boxes** (`POST /api/trays/{trayId}/vision`); optional **`CV_TRAY_INFERENCE_URL`** ([docs/CV_PIPELINE.md](docs/CV_PIPELINE.md)).
- **Plants** — Detail: stats, latest finding, photo upload, edit (name / species / description), delete, health trend chart, report history, monitoring log (plant-scoped with tray fallback).
- **Add plant** (`/plants/new`) — Tray picker + leaf photo; species/disease classification via **`CV_SPECIES_INFERENCE_URL`** (e.g. **`cv-backend`** on [PlantVillage `raw/color`](https://github.com/spMohanty/PlantVillage-Dataset/tree/master/raw/color)) is **required** for `POST /api/plants/from-photo` to succeed—there is no local simulator. See [docs/CV_PIPELINE.md](docs/CV_PIPELINE.md). Optional **training feedback** (same photo) is documented in [docs/FEEDBACK_AND_RECLASSIFICATION.md](docs/FEEDBACK_AND_RECLASSIFICATION.md).
- **Feedback** (`/feedback`) — Upload images with corrective labels and comments for model improvement; integrated with add-plant flows. See [docs/FEEDBACK_AND_RECLASSIFICATION.md](docs/FEEDBACK_AND_RECLASSIFICATION.md).
- **Mesh** — Group trays; mesh detail with merged activity and plants.
- **Schedule** — Capture intervals for trays or meshes.
- **Standalone build** — `output: "standalone"`; `postbuild` copies static assets into `.next/standalone` for container runs.

## Configuration

| Area | Notes |
|------|--------|
| **`POSTGRES_*`** | Required. `src/lib/db/postgres.ts` exposes `requirePostgresPool()` for write paths; listing trays/plants/etc. uses SQL queries. Legacy **`MARIADB_*`** names are still read as aliases in `src/lib/config/env.ts`. |
| **`FIREBASE_*`** | Required for authentication. `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, and `FIREBASE_APP_ID` configure the browser login flow; `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` or `FIREBASE_SERVICE_ACCOUNT_JSON` enable server-side session verification. |
| **`CV_SPECIES_INFERENCE_URL`** | Required for **add plant from photo** and for analyzing leaf uploads that call the species classifier. |
| **`CV_TRAY_INFERENCE_URL`** | Optional; tray photo analysis can use a remote detector or the built-in simulator when unset. |
| **`QDRANT_*`** | Optional; when unset, vector-dependent features degrade gracefully (empty similarity lists, health reports `vectorStore: disconnected`). |

See `.env.example` for full variable list and storage layout.

## Local setup

1. Copy `.env.example` to `.env` / `.env.local` and set **`POSTGRES_*`**, the required **`FIREBASE_*`** auth variables, and **`CV_SPECIES_INFERENCE_URL`** if you use photo flows.
2. In the Firebase console, enable the **Email/Password** and **Google** sign-in providers for your project, and ensure your local or deployed app domain is listed under Firebase Auth authorized domains for Google sign-in.
3. `npm install`
4. Create the database user/db if needed, then apply schema: `npm run db:schema` (and optionally `npm run db:seed` for sample rows).
5. `npm run dev` → [http://localhost:3000](http://localhost:3000)
6. Production build: `npm run build` then `npm start` (or `npm run start:standalone` after build for the standalone server from repo root).

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/IMPLEMENTATION_GUIDE.md](docs/IMPLEMENTATION_GUIDE.md) | Scope, architecture pointers, REST/GraphQL, schema, env, roadmap |
| [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) | Short roadmap for the next sprint, near-term hardening, and platform follow-ons |
| [docs/UI_LAYOUT_AND_DESIGN.md](docs/UI_LAYOUT_AND_DESIGN.md) | App shell, navigation, visual tokens, component usage |
| [docs/CV_PIPELINE.md](docs/CV_PIPELINE.md) | PlantVillage training + `cv-backend`, species/disease HTTP contract, tray CV |
| [docs/FEEDBACK_AND_RECLASSIFICATION.md](docs/FEEDBACK_AND_RECLASSIFICATION.md) | Image feedback, reclassification labels, add-plant integration, ML export, retrain gate |
| [cv-backend/README.md](cv-backend/README.md) | PyTorch train/serve commands, Docker |
| [docs/PLANT_TRAINER_AND_CLASSIFIER.md](docs/PLANT_TRAINER_AND_CLASSIFIER.md) | GPU Compose services for train vs classify |
| [docs/diagrams/README.md](docs/diagrams/README.md) | **Mermaid** diagrams: architecture, integrations, UML-style domain/services, use cases |
| [docs/USER_STORIES.md](docs/USER_STORIES.md) | User stories across UI, backend, training, inference, and ops |

## API routes (REST)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | `api`, `database` (`connected` / `disconnected`), `vectorStore`, `cameraPipeline`, `trayVisionInference` (`remote` / `simulated`), `speciesInference` (`remote` / `unconfigured`) |
| GET | `/api/camera/latest` | `?trayId=` optional |
| POST | `/api/camera/ingest` | JSON body — frame metadata |
| GET | `/api/predictions/latest` | `?trayId=` optional |
| GET | `/api/monitoring/log` | `limit`, `trayId`, `plantId` |
| GET | `/api/trays` | All tray systems |
| POST | `/api/trays/{trayId}/vision` | Multipart `photo` — tray plant detection + count; persists CV fields on tray |
| GET | `/api/plants` | `?trayId=` optional |
| POST | `/api/plants/manual` | JSON — create plant by name/cultivar |
| POST | `/api/plants/from-photo` | Multipart `photo` — species via remote classifier + plant + report (requires `CV_SPECIES_INFERENCE_URL`) |
| PATCH | `/api/plants/[plantId]` | JSON: `name`, `cultivar`, `description` (at least one) |
| DELETE | `/api/plants/[plantId]` | Remove plant |
| POST | `/api/plants/[plantId]/photo` | Multipart `photo` — analyze existing plant |
| GET | `/api/reports` | `trayId`, `plantId`, `limit` |
| GET | `/api/files/...` | Serves validated files from app storage (`STORAGE_*`; used with `next/image` local patterns) |
| GET/POST | `/api/mesh` | List / create mesh |
| GET/POST/PATCH | `/api/schedules` | List / create / update schedules |
| POST | `/api/graphql` | GraphQL (queries + `createMeshNetwork`, `updatePlant`, `deletePlant`, `upsertSchedule`) |

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
- `npm run db:schema` / `npm run db:seed` — apply `db/schema.sql` and optional seed to PostgreSQL (see script and `.env`)

## License / status

Internal / project-specific. **Tray-level** vision can use a remote detector or the built-in simulator (`CV_TRAY_INFERENCE_URL` optional). **Leaf species** classification requires a running **`CV_SPECIES_INFERENCE_URL`** service (no hash simulator). Camera ingest and predictions remain mock-friendly until wired to production hardware and models.
