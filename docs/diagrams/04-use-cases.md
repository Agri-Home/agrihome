# Use case diagrams

Operator (grower / facility user) interacting with the Vision Console.

## Primary use cases

```mermaid
flowchart TB
  Actor[Operator]

  UC1([View overview and home])
  UC2([Browse trays])
  UC3([Open tray detail])
  UC4([View plant detail])
  UC5([Add plant from photo])
  UC6([Browse mesh networks])
  UC7([Open mesh detail])
  UC8([Manage capture schedules])
  UC9([Create mesh grouping trays])
  UC10([Run tray photo CV count])

  Actor --> UC1
  Actor --> UC2
  Actor --> UC3
  Actor --> UC4
  Actor --> UC5
  Actor --> UC6
  Actor --> UC7
  Actor --> UC8
  Actor --> UC9
  Actor --> UC10

  UC3 --> UC4
  UC3 --> UC10
  UC2 --> UC3
  UC6 --> UC7
```

## Use case — add plant with auto-identification

Equivalent to a classic use-case diagram: the operator selects a tray and uploads a photo; inner steps chain as include-style dependencies.

```mermaid
flowchart TB
  Operator([Operator])

  subgraph AgriHome [AgriHome]
    UC_T([Select tray])
    UC_P([Upload or capture plant photo])
    UC_D([Auto-detect species via CV service])
    UC_C([Create plant record])
    UC_H([Run health analysis])
    UC_V([View identification and report])
  end

  Operator --> UC_T
  Operator --> UC_P
  Operator --> UC_V
  UC_P -.->|include| UC_D
  UC_D -.->|include| UC_C
  UC_C -.->|include| UC_H
  UC_H -.->|include| UC_V
```

## Use case — integrator (API and GraphQL)

```mermaid
flowchart TB
  Integrator([Integrator])

  subgraph APIs [APIs]
    Q1([Query trays plants reports])
    Q2([Ingest camera frame])
    Q3([GraphQL consolidated read])
    Q4([Create mesh and schedule])
    Q5([Update or delete plant])
  end

  Integrator --> Q1
  Integrator --> Q2
  Integrator --> Q3
  Integrator --> Q4
  Integrator --> Q5
```

## Mapping to routes (operator UI)

| Use case | Typical route |
|----------|----------------|
| Overview | `/` |
| Tray list | `/trays` |
| Tray detail | `/trays/[trayId]` |
| Plant detail | `/plants/[plantId]` |
| Add plant (photo-first) | `/plants/new` |
| Mesh list / create | `/mesh` |
| Mesh detail | `/mesh/[meshId]` |
| Schedules | `/schedule` |
| Tray CV photo | `/trays/[trayId]` (vision upload / analysis UI) |
