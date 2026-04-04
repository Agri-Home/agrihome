# Integration diagram

Boundaries between the dashboard, persistence, and future / external systems.

```mermaid
flowchart LR
  subgraph operator [Operator]
    U[User / grower]
  end

  subgraph agrihome [AgriHome Vision Console]
    UI[Next.js UI + REST + GraphQL]
  end

  subgraph data [Configured backends]
    PG[(PostgreSQL)]
    Q[(Qdrant)]
  end

  subgraph future [Planned / external]
    Edge[Edge camera devices]
    CV[Computer vision / ML service]
    Obj[Object storage for frames]
  end

  U --> UI
  UI --> PG
  UI --> Q
  Edge -.->|"POST /api/camera/ingest\n(image URL or ref)"-.-> UI
  UI -.->|"schedules.destination\n→ future CV backend"-.-> CV
  Edge -.-> Obj
  CV -.-> Obj
```

## Integration summary

| System | Role today | Protocol / notes |
|--------|------------|------------------|
| **PostgreSQL** | Canonical trays, plants, captures, predictions, reports, events, meshes, schedules | `pg` pool; env `POSTGRES_*` |
| **Qdrant** | Optional vector similarity for “reference” matches | REST client; env `QDRANT_*`; often mocked |
| **Browser** | SPA + PWA (`PwaProvider`, `sw.js`) | HTTPS in production |
| **File uploads** | User plant photos → `public/uploads/plants/` | Multipart `POST /api/plants/from-photo` |
| **Edge cameras** | Not shipped; ingest contract via JSON body | `POST /api/camera/ingest` |
| **Real ML** | Simulated: `derivePredictionFromCapture`, `detectPlantSpeciesFromImage` | Replace service internals |

```mermaid
sequenceDiagram
  participant O as Operator
  participant N as Next.js API
  participant S as Services
  participant M as Mock store / DB

  O->>N: POST /api/plants/from-photo (multipart)
  N->>S: createPlantFromPhotoWithAutoDetection
  S->>S: detectPlantSpeciesFromImage (bytes)
  S->>M: create plant + capture + report
  M-->>S: plant + analysis
  S-->>N: JSON
  N-->>O: identification + health report
```
