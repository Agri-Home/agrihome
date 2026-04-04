# Computer vision pipeline: PlantVillage, tray analysis, and AgriHome

This document connects **ML training** to AgriHome APIs.

| Use case | Dataset / approach | AgriHome integration |
|----------|-------------------|----------------------|
| **Crop + disease from leaf image** | [PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset) (`raw/color` class folders) | `CV_SPECIES_INFERENCE_URL` → `cv-backend` FastAPI (`/v1/classify`) |
| **Plants per tray (count + boxes)** | Object detector on your tray images | `CV_TRAY_INFERENCE_URL` (separate model) |

PlantVillage folders use the pattern **`Crop___Condition`** (e.g. `Tomato___Early_blight`, `Tomato___healthy`, `Apple___Apple_scab`). One multi-class classifier therefore predicts **both** plant type and **disease vs healthy** in a single forward pass.

## PlantVillage dataset

- **Repository:** [spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset)  
- **RGB images:** [raw/color](https://github.com/spMohanty/PlantVillage-Dataset/tree/master/raw/color) — each subdirectory is one class (38 classes in the standard split).

Clone and use the `raw/color` tree as **`torchvision.datasets.ImageFolder`** root (or symlink that folder to `cv-backend/data/plantvillage`).

```bash
git clone https://github.com/spMohanty/PlantVillage-Dataset.git
# Train with --data-dir pointing at PlantVillage-Dataset/raw/color
```

## Train and serve (this repo)

Python backend lives in **`cv-backend/`**:

1. **`python -m venv .venv && source .venv/bin/activate`** (or Windows equivalent).
2. **`pip install -r cv-backend/requirements.txt`**
3. **Train:**  
   `python cv-backend/train.py --data-dir /path/to/PlantVillage-Dataset/raw/color --epochs 15 --output-dir cv-backend/artifacts`
4. **Serve:**  
   `python cv-backend/serve.py --checkpoint cv-backend/artifacts/best.pt --classes cv-backend/artifacts/classes.json --host 0.0.0.0 --port 8765`
5. In AgriHome **`.env`**:  
   `CV_SPECIES_INFERENCE_URL=http://localhost:8765/v1/classify`

The server uses **OpenCV** to decode bytes and optional **CLAHE** in LAB space for more stable lighting (`USE_CLAHE=1`). Inference is **PyTorch** (ResNet-18 backbone by default).

## What the app does today

| Capability | Behavior |
|------------|----------|
| Tray analysis | `POST /api/trays/{trayId}/vision` — multipart `photo` |
| Leaf ID + disease hint | `POST /api/plants/from-photo` → `detectPlantSpeciesFromImage` → optional **`CV_SPECIES_INFERENCE_URL`** |
| Default | Simulators when URLs unset |

Run **`db/migrations/001_tray_vision.sql`** if your DB predates tray vision columns.

## HTTP contract for species / disease inference (`CV_SPECIES_INFERENCE_URL`)

**Request:**

```http
POST /v1/classify
Content-Type: application/json
Authorization: Bearer <optional CV_SPECIES_INFERENCE_API_KEY>
```

```json
{
  "imageBase64": "<base64-encoded JPEG/PNG bytes>"
}
```

**Response** (from `cv-backend/serve.py`; AgriHome accepts these fields):

```json
{
  "commonName": "Tomato",
  "cultivar": "Early blight",
  "identificationConfidence": 0.94,
  "plantCondition": "Early blight",
  "rawLabel": "Tomato___Early_blight",
  "isHealthy": false
}
```

**Aliases** the TypeScript client accepts:

- **`label`** — full PlantVillage folder name (parsed on `___` if **`commonName`** missing).
- **`scientificName`** instead of **`cultivar`**.
- **`confidence`** instead of **`identificationConfidence`**.
- **`disease`** or **`condition`** instead of **`plantCondition`**.

If the URL is unset or the call fails, AgriHome **falls back to the simulator**.

---

## HTTP contract for tray inference (`CV_TRAY_INFERENCE_URL`)

Same as before: JSON body `{ "imageBase64": "..." }`, response with `count`, `countConfidence`/`confidence`, `instances[]` (normalized boxes). See tray section in the implementation guide if you add a dedicated detector.

## Environment variables (AgriHome)

| Variable | Purpose |
|----------|---------|
| `CV_TRAY_INFERENCE_URL` | Tray photo → count + boxes |
| `CV_TRAY_INFERENCE_API_KEY` | Optional Bearer token |
| `CV_SPECIES_INFERENCE_URL` | Leaf photo → crop + condition (PlantVillage-trained `cv-backend`) |
| `CV_SPECIES_INFERENCE_API_KEY` | Optional Bearer token |

## UI and GraphQL

- Add-plant flow shows **crop**, **condition / disease**, and confidence when the backend returns them.
- `health` / `GET /api/health` exposes **`speciesInference`** and **`trayVisionInference`**.

## Production notes

- Fine-tune on **your** greenhouse images; domain shift from PlantVillage leaves is the main failure mode.
- Export **TorchScript** or **ONNX** later if you want a non-Python edge runtime; keep the same JSON contract in a thin wrapper.
- For **tray counting**, train a detector on tray photos; PlantVillage alone does not replace that task.
