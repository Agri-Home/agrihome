# Computer vision pipeline: PlantVillage, tray analysis, and AgriHome

This document connects **ML training** to AgriHome APIs.

**Docker GPU stack:** For **`plant-trainer`** and **`plant-classifier`** (compose, volumes, training vs inference workflows), see [PLANT_TRAINER_AND_CLASSIFIER.md](./PLANT_TRAINER_AND_CLASSIFIER.md).

| Use case | Dataset / approach | AgriHome integration |
|----------|-------------------|----------------------|
| **Crop + disease from leaf image** | [PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset) (`raw/color` class folders) | `CV_SPECIES_INFERENCE_URL` → `cv-backend` FastAPI (`/v1/classify`) |
| **Plants per tray (count + boxes)** | Object detector on your tray images | `CV_TRAY_INFERENCE_URL` (separate model) |

PlantVillage folders use the pattern **`Crop___Condition`** (e.g. `Tomato___Early_blight`, `Tomato___healthy`, `Apple___Apple_scab`). One multi-class classifier therefore predicts **both** plant type and **disease vs healthy** in a single forward pass.

## PlantVillage dataset

- **Repository:** [spMohanty/PlantVillage-Dataset](https://github.com/spMohanty/PlantVillage-Dataset)  
- **RGB images:** [raw/color](https://github.com/spMohanty/PlantVillage-Dataset/tree/master/raw/color) — each subdirectory is one class (38 classes in the standard split).

Clone and use the `raw/color` tree as **`torchvision.datasets.ImageFolder`** root (or symlink that folder to `cv-backend/data/plantvillage`). If you point at **`raw/`** instead, class names become **`color` / `grayscale` / `segmented`** and the app will show nonsense labels — always use **`raw/color`**.

### Troubleshooting: API returns `"commonName": "color"` / `"rawLabel": "color"`

**A) `classes.json` on the host really is `Apple___…` (you `cat` the file and it looks correct)**  
Then the HTTP response is **not** using that file path inside the running process. Common causes:

1. **`plant-classifier` was not restarted** after you replaced `artifacts/` — Python loads `classes.json` **once at startup**. Old labels stay in memory until you restart the container/process.
2. **AgriHome calls a different URL** than the host you checked — verify **`CV_SPECIES_INFERENCE_URL`** in the app’s `.env` matches the machine/port where you run **`serve.py`** (not an old laptop or another NAS service on port 8765).

**Verify the running server (not only the file on disk):**

```bash
curl -s http://<classifier-host>:8765/health
```

**Smoke-test classify** with a real tiny image (empty `imageBase64` returns **400**, not 500):

```bash
# Encode one JPEG (GNU: base64 -w0 file; macOS: base64 -i file | tr -d '\n')
B64=$(base64 -w0 ./some-leaf.jpg 2>/dev/null || base64 ./some-leaf.jpg | tr -d '\n')
curl -s -X POST "http://<classifier-host>:8754/v1/classify" \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$B64\"}"
```

You should see **`first_class": "Apple___Apple_scab"`** (or whatever is first in **your** JSON), **`classes_file`** pointing at the mounted path (e.g. `/workspace/artifacts/classes.json`), and **`num_classes`** matching the length of your list. If **`first_class` is `color`**, the process is still on an old load — **restart** `plant-classifier`.

**B) `classes.json` on disk actually lists `color` / `grayscale` / `segmented`**  
Training used PlantVillage **`raw/`** as the ImageFolder root instead of **`raw/color`**. Retrain with **`--data-dir .../raw/color`**. **`train.py`** and **`serve.py`** reject split-folder names in `classes.json` so new bad configs fail fast.

**C) `best.pt` and `classes.json` are from different runs**  
**`serve.py`** now requires **`len(classes.json) == checkpoint `fc` output size**; it will refuse to start if they disagree. Fix by copying both files from the same **`artifacts/`** directory after one training run.

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
   Use the **host port** you publish (e.g. Compose `ports: ["8754:8765"]` → `http://192.168.0.142:8754/v1/classify`). The value must include **`/v1/classify`** — the app does not append it.

The server uses **OpenCV** to decode bytes and optional **CLAHE** in LAB space for more stable lighting (`USE_CLAHE=1`). Inference is **PyTorch** (ResNet-18 backbone by default).

## What the app does today

| Capability | Behavior |
|------------|----------|
| Tray analysis | `POST /api/trays/{trayId}/vision` — multipart `photo` |
| Leaf ID + disease hint | `POST /api/plants/from-photo` → `detectPlantSpeciesFromImage` → optional **`CV_SPECIES_INFERENCE_URL`** |
| Species inference | Requires **`CV_SPECIES_INFERENCE_URL`**; failures surface as API errors (no local fallback) |
| Custom plants | Plant page: new leaf photo anytime (`POST /api/plants/{id}/photo`), edit name / species label / description (`PATCH /api/plants/{id}`), delete (`DELETE /api/plants/{id}`) |

Run **`db/migrations/001_tray_vision.sql`** if your DB predates tray vision columns. Run **`db/migrations/002_plant_description.sql`** if `plants.description` is missing.

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

If **`CV_SPECIES_INFERENCE_URL`** is unset, `detectPlantSpeciesFromImage` **throws** and photo-based flows return an error. If the HTTP request fails, returns a non-OK status, or returns a body that cannot be parsed, the request **fails**—there is **no** local hash simulator for species ID.

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
