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
  Edge -.->|POST /api/camera/ingest| UI
  UI -.->|schedules point at future CV| CV
  Edge -.-> Obj
  CV -.-> Obj
```

## Integration summary

| System | Role today | Protocol / notes |
|--------|------------|------------------|
| **PostgreSQL** | Canonical trays, plants, captures, predictions, reports, events, meshes, schedules | `pg` pool; env `POSTGRES_*` (required) |
| **Qdrant** | Optional vector similarity for “reference” matches | REST client; env `QDRANT_*` |
| **Browser** | SPA + PWA (`PwaProvider`, `sw.js`) | HTTPS in production |
| **File uploads** | User plant photos → configurable `STORAGE_*` paths; URLs often under `/api/files/...` | Multipart `POST /api/plants/from-photo`, `POST /api/plants/{id}/photo`, tray `POST /api/trays/{id}/vision` |
| **Edge cameras** | Not shipped; ingest contract via JSON body | `POST /api/camera/ingest` |
| **CV HTTP** | Optional `CV_TRAY_INFERENCE_URL`, `CV_SPECIES_INFERENCE_URL` | Species path requires configured URL; tray path can use simulator when unset |

```mermaid
sequenceDiagram
  participant O as Operator
  participant N as Next.js API
  participant S as Services
  participant DB as PostgreSQL + storage

  O->>N: POST /api/plants/from-photo (multipart)
  N->>S: createPlantFromPhotoWithAutoDetection
  S->>S: detectPlantSpeciesFromImage (bytes)
  S->>DB: create plant + capture + report
  DB-->>S: plant + analysis
  S-->>N: JSON
  N-->>O: identification + health report
```
