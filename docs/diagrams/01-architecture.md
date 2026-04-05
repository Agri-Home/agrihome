# Architecture diagram

High-level view of the AgriHome Vision Console: Next.js full-stack app, service layer, PostgreSQL, and optional Qdrant / CV HTTP services.

```mermaid
flowchart TB
  subgraph clients [Clients]
    Browser["Browser / mobile PWA"]
  end

  subgraph next [Next.js application]
    Shell["AppShell — nav + layout"]
    Pages["App Router pages\n/ · /trays · /plants · /mesh · /schedule · /plants/new"]
    RSC["Server Components — data fetch"]
    Client["Client Components — charts, forms, PWA"]
    API["REST route handlers\n/api/*"]
    GQL["GraphQL Yoga\nPOST /api/graphql"]
    Shell --> Pages
    Pages --> RSC
    Pages --> Client
    RSC --> Services
    Client --> API
    API --> Services
    GQL --> Services
  end

  subgraph lib [Service layer — src/lib/services]
    Services["camera · prediction · plant · topology\nmonitoring · schedule · vector\nplant-manual · plant-detection · tray-vision"]
  end

  subgraph persistence [Persistence — optional]
    PG[("PostgreSQL\nschema: db/schema.sql")]
    QD[("Qdrant\nsimilarity — optional")]
  end

  subgraph static [Static assets]
    Public["public/ · storage/\nimages · sw.js · originals"]
  end

  Browser --> Shell
  Services -->|"POSTGRES_* pool"| PG
  Services -->|"QDRANT_* configured"| QD
  RSC --> Public
  Client --> Public
```

## Data path

| Component | Role |
|-----------|------|
| **PostgreSQL** | Canonical trays, plants, captures, predictions, reports, events, meshes, schedules (`db/schema.sql`) |
| **Disk storage** | Optional `STORAGE_*` roots; images served via `GET /api/files/...` |
| **Qdrant** | Optional similarity search when `QDRANT_URL` is set |

## Build output

- `output: "standalone"` in `next.config.ts` for container images.
- After `npm run build`, `postbuild` copies `.next/static` and `public` into `.next/standalone` for a runnable bundle.
