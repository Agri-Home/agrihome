# Architecture diagram

High-level view of the AgriHome Vision Console: Next.js full-stack app, service layer, and dual data paths (mock vs PostgreSQL).

```mermaid
flowchart TB
  subgraph clients [Clients]
    Browser["Browser / mobile PWA"]
  end

  subgraph next [Next.js application]
    Shell["AppShell — nav + layout"]
    Pages["App Router pages\n/ · /trays · /plants · /mesh · /schedule"]
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
    Services["camera · prediction · plant · topology\nmonitoring · schedule · vector\nplant-manual · plant-detection"]
    Mocks["mock-store + mocks/data\nsimulation + seed"]
    Services --> Mocks
  end

  subgraph persistence [Persistence — optional]
    PG[("PostgreSQL\nschema: db/schema.sql")]
    QD[("Qdrant\nsimilarity — optional")]
  end

  subgraph static [Static assets]
    Public["public/\nimages · uploads/plants · sw.js"]
  end

  Browser --> Shell
  Services -->|"NEXT_PUBLIC_USE_MOCK_DATA=false\n+ pool"| PG
  Services -->|"QDRANT_* configured"| QD
  RSC --> Public
  Client --> Public
```

## Runtime modes

| Mode | Data source |
|------|-------------|
| **Mock (default)** | In-memory `mock-store` seeded from `createMockSeed()` |
| **Live DB** | `NEXT_PUBLIC_USE_MOCK_DATA=false` and `POSTGRES_*` set → SQL queries; failures fall back to mock |

## Build output

- `output: "standalone"` in `next.config.ts` for container images.
- After `npm run build`, `postbuild` copies `.next/static` and `public` into `.next/standalone` for a runnable bundle.
