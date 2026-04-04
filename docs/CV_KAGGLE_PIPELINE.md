# Computer vision: Kaggle datasets → tray plant detection and counting

This document ties **external model training** (often starting from [Kaggle](https://www.kaggle.com/datasets) plant or crop datasets) to **AgriHome** features:

- **Per-tray plant instance detection** — bounding boxes over individual plants in a top-down tray image.
- **Per-tray plant count** — number of instances, with a confidence score.

Single-plant **species / cultivar** hints from a close-up photo stay in `detectPlantSpeciesFromImage` (`src/lib/services/plant-detection-service.ts`); you can replace that function with the same HTTP pattern described below.

## What the app does today

| Capability | Behavior |
|------------|----------|
| Tray analysis API | `POST /api/trays/{trayId}/vision` — multipart field `photo` |
| Persistence | Updates `vision_plant_count`, `vision_plant_count_at`, `vision_plant_count_confidence`, `vision_detections_json` on `tray_systems` (or the in-memory mock store) |
| Default | **Simulated** counts and boxes derived from image bytes (deterministic, no real model) |
| Remote model | Set **`CV_TRAY_INFERENCE_URL`** to POST JSON `{ "imageBase64": "..." }` and return the JSON contract below |

Run **`db/migrations/001_tray_vision.sql`** on databases that were created before these columns existed.

## Suggested ML stack (Kaggle → production-shaped service)

1. **Pick datasets** aligned with your camera setup (top-down vs side view, lettuce vs mixed crops). Combine multiple Kaggle datasets only after harmonizing labels and resolution.
2. **Task choice**
   - **Object detection** (YOLO, RT-DETR, Detectron2, etc.) — gives **boxes + count** in one pass. Best match for “plants per tray.”
   - **Instance segmentation** — tighter masks; heavier to label and run.
   - **Classification only** — does **not** yield a count; use only for species/health on a cropped plant.
3. **Train** in a Kaggle notebook or locally, then **export**:
   - **ONNX** or **TorchScript** for a small GPU/CPU inference server, or
   - **TensorFlow SavedModel** if you prefer TFServing.
4. **Serve** behind HTTPS with a tiny wrapper (FastAPI, Flask, or Node) that accepts JSON and returns the contract below.

## HTTP contract for `CV_TRAY_INFERENCE_URL`

**Request** (what AgriHome sends):

```http
POST /your/tray/endpoint
Content-Type: application/json
Authorization: Bearer <optional CV_TRAY_INFERENCE_API_KEY>
```

```json
{
  "imageBase64": "<base64-encoded JPEG/PNG bytes>"
}
```

**Response** (what your service must return on success):

```json
{
  "count": 8,
  "countConfidence": 0.91,
  "instances": [
    { "x": 0.12, "y": 0.31, "w": 0.14, "h": 0.18, "score": 0.87, "label": "plant" },
    { "x": 0.45, "y": 0.28, "w": 0.12, "h": 0.16, "score": 0.82 }
  ]
}
```

Field notes:

- **`count`** — integer plant instance count (should match your detector’s count or NMS output).
- **`countConfidence`** — optional alias **`confidence`** is also accepted.
- **`instances`** — boxes in **normalized 0–1** coordinates relative to image width/height (same convention as training export).
- **`label`** — optional per-box class name from your detector.

If the URL is unset or the remote call fails, AgriHome **falls back to the simulator** so the UI keeps working.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `CV_TRAY_INFERENCE_URL` | HTTPS URL for tray photo inference |
| `CV_TRAY_INFERENCE_API_KEY` | Optional `Authorization: Bearer` value |

Add these to `.env` / `.env.local` (see `.env.example`).

## UI and GraphQL

- Tray detail shows **Plants (catalog)** vs **CV plant count** after an analysis.
- GraphQL `TraySystem` exposes `visionPlantCount`, `visionPlantCountAt`, `visionPlantCountConfidence`, and `visionDetections { x y w h score label }`.
- `health` / `GET /api/health` includes **`trayVisionInference`**: `remote` or `simulated`.

## Next steps you may want

- Draw `visionDetections` overlays on the tray image in the browser (canvas/SVG).
- On **`POST /api/camera/ingest`**, optionally fetch `imageUrl` and call the same analyzer when `destination` is your CV service (batch / edge friendly).
- Add **`CV_SPECIES_INFERENCE_URL`** mirroring tray inference for `from-photo` species ID (not implemented as env yet; extend `plant-detection-service.ts` the same way as `tray-vision-service.ts`).
