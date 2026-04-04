# UML-style diagrams (Mermaid)

## Domain model (conceptual)

Core types from `src/lib/types/domain.ts` and their relationships.

```mermaid
classDiagram
  direction TB

  class TraySystem {
    +string id
    +string name
    +string zone
    +string crop
    +int plantCount
    +int healthScore
    +TrayHealthStatus status
    +string deviceId
    +string lastCaptureAt
  }

  class PlantUnit {
    +string id
    +string trayId
    +string[] meshIds
    +string name
    +string cultivar
    +string slotLabel
    +int row
    +int column
    +int healthScore
    +PlantHealthStatus status
    +string lastReportAt
    +string latestDiagnosis
    +string lastImageUrl
    +string lastImageAt
  }

  class MeshNetwork {
    +string id
    +string name
    +string[] trayIds
    +int nodeCount
    +MeshStatus status
    +string createdAt
    +string summary
  }

  class CameraCapture {
    +string id
    +string trayId
    +string imageUrl
    +string capturedAt
    +CaptureStatus status
  }

  class PredictionResult {
    +string id
    +string captureId
    +string trayId
    +string label
    +float confidence
    +Severity severity
  }

  class PlantReport {
    +string id
    +string plantId
    +string trayId
    +string diagnosis
    +Severity severity
    +string summary
  }

  class MonitoringEvent {
    +string id
    +string level
    +string title
    +string message
  }

  class CaptureSchedule {
    +string scopeType
    +string scopeId
    +int intervalMinutes
    +bool active
  }

  TraySystem "1" --> "*" PlantUnit : contains
  MeshNetwork "1" --> "*" TraySystem : groups
  PlantUnit "1" --> "*" PlantReport : has
  CameraCapture "1" --> "0..1" PredictionResult : produces
  TraySystem "1" --> "*" CameraCapture : captures
```

## Service layer (simplified)

How route handlers depend on services (not every import shown).

```mermaid
classDiagram
  direction LR

  class RouteHandlers {
    <<Next.js>>
    /api/*
  }

  class PlantService {
    +listPlantsByTray()
    +getPlantById()
    +listPlantReports()
  }

  class TopologyService {
    +listTraySystems()
    +listMeshNetworks()
    +createMeshNetwork()
  }

  class CameraService {
    +getLatestCameraCapture()
    +ingestCameraCapture()
  }

  class PredictionService {
    +getLatestPrediction()
  }

  class MonitoringService {
    +getMonitoringLog()
  }

  class PlantManualService {
    +createManualPlant()
    +createPlantFromPhotoWithAutoDetection()
    +analyzePlantPhotoFromUpload()
  }

  class PlantDetectionService {
    +detectPlantSpeciesFromImage()
  }

  class MockStore {
    +getMockStore()
    +ingestMockCapture()
    +finalizePlantPhotoAnalysisForPlant()
  }

  RouteHandlers --> PlantService
  RouteHandlers --> TopologyService
  RouteHandlers --> CameraService
  RouteHandlers --> PredictionService
  RouteHandlers --> MonitoringService
  RouteHandlers --> PlantManualService
  PlantManualService --> PlantDetectionService
  PlantManualService --> PlantService
  PlantManualService --> CameraService
  PlantService --> MockStore
  TopologyService --> MockStore
  CameraService --> MockStore
```
