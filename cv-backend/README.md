# PlantVillage CV backend (PyTorch + OpenCV + FastAPI)

Trains and serves a **single multi-class model** on the [PlantVillage `raw/color`](https://github.com/spMohanty/PlantVillage-Dataset/tree/master/raw/color) layout: each folder name is **`Crop___Condition`** (disease or `healthy`). That matches **plant ID + disease detection** in one head.

## Setup

```bash
cd cv-backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

If you need a specific CUDA build of PyTorch, install `torch` / `torchvision` from [pytorch.org](https://pytorch.org/) before the rest.

## Get the data

```bash
git clone https://github.com/spMohanty/PlantVillage-Dataset.git
export PV_COLOR="$PWD/PlantVillage-Dataset/raw/color"
```

## Train

```bash
python train.py --data-dir "$PV_COLOR" --epochs 20 --output-dir ./artifacts
```

Outputs:

- `artifacts/best.pt` — weights  
- `artifacts/classes.json` — class order (must stay aligned with the checkpoint)

Adjust `--epochs`, `--batch-size`, and `--lr` for your GPU. CPU training is slow but works for smoke tests.

## Serve (AgriHome `CV_SPECIES_INFERENCE_URL`)

```bash
python serve.py --checkpoint ./artifacts/best.pt --classes ./artifacts/classes.json --host 0.0.0.0 --port 8765
```

Optional lighting normalization before the CNN:

```bash
export USE_CLAHE=1
python serve.py --checkpoint ./artifacts/best.pt --classes ./artifacts/classes.json
```

In the AgriHome repo `.env`:

```env
CV_SPECIES_INFERENCE_URL=http://127.0.0.1:8765/v1/classify
```

## API

- `POST /v1/classify` — body `{ "imageBase64": "..." }` → JSON with `commonName`, `cultivar`, `plantCondition`, `rawLabel`, `isHealthy`, `identificationConfidence`.  
- `GET /health` — process up and class count.

## Server: Docker Compose + NVIDIA (Tesla P40, etc.)

Your **“sleep infinity” + bind mounts** pattern is right. Prefer the CUDA image in this folder so PyTorch matches the GPU.

### 1. Host

- Install the **NVIDIA driver** and **[NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)**.
- Put PlantVillage **`raw/color`** on the server (e.g. `/mnt/mainpool/datasets/plantvillage`) so it contains folders like `Tomato___healthy/`, not a parent `raw/` only.
- Create a workspace (e.g. `/mnt/mainpool/apps/agrihome-train`) and copy **`train.py`**, **`serve.py`**, and build context for **`Dockerfile.cuda`** (or clone the repo and point the volume at `.../agrihome/cv-backend`).

### 2. Build the CV image

```bash
cd /path/to/cv-backend   # directory with Dockerfile.cuda
docker build -f Dockerfile.cuda -t agrihome-plant-cv:cuda .
```

### 3. Merge into your Agrihome compose (recommended)

Add two services on the **same `networks: [agrihome_net]`** as `agrihome`, and point the app at the API by **container name**:

```yaml
  plant-trainer:
    image: agrihome-plant-cv:cuda
    container_name: plant-trainer
    restart: unless-stopped
    working_dir: /workspace
    command: sleep infinity
    environment:
      NVIDIA_VISIBLE_DEVICES: "0"   # P40; nvidia-smi -L to confirm index
      NVIDIA_DRIVER_CAPABILITIES: compute,utility
    volumes:
      - /mnt/mainpool/apps/agrihome-train:/workspace
      - /mnt/mainpool/datasets/plantvillage:/data/plantvillage:ro
    gpus:
      - driver: nvidia
        count: 1
        capabilities: [gpu]
    networks:
      - agrihome_net

  plant-cv:
    image: agrihome-plant-cv:cuda
    container_name: plant-cv
    restart: unless-stopped
    environment:
      NVIDIA_VISIBLE_DEVICES: "0"
      NVIDIA_DRIVER_CAPABILITIES: compute,utility
    command:
      - python
      - serve.py
      - --checkpoint
      - /workspace/artifacts/best.pt
      - --classes
      - /workspace/artifacts/classes.json
      - --host
      - 0.0.0.0
      - --port
      - "8765"
    volumes:
      - /mnt/mainpool/apps/agrihome-train:/workspace:ro
    ports:
      - "8765:8765"
    gpus:
      - driver: nvidia
        count: 1
        capabilities: [gpu]
    networks:
      - agrihome_net
```

On **`agrihome`**, add:

```yaml
      CV_SPECIES_INFERENCE_URL: http://plant-cv:8765/v1/classify
```

If **`gpus:`** is not supported, use **`runtime: nvidia`** on the service (older Compose) and keep **`NVIDIA_VISIBLE_DEVICES`**.

### 4. Train (one-off)

```bash
docker compose exec plant-trainer bash
cd /workspace
python train.py --data-dir /data/plantvillage --epochs 25 --output-dir ./artifacts --batch-size 128
exit
docker compose up -d plant-cv   # after best.pt exists
```

### 5. Reference files

- [docker-compose.server.example.yml](./docker-compose.server.example.yml) — standalone variant.
- **`pytorch/pytorch:*-cuda*-cudnn*-runtime`** tag must be compatible with your driver; adjust **`Dockerfile.cuda`** `ARG PYTORCH_IMAGE` if needed.

## Notes

- **Tray counting** is not covered here; use a separate detector and `CV_TRAY_INFERENCE_URL` in AgriHome.  
- For production, add auth (reverse proxy + API key), rate limits, and fine-tuning on your own leaf images.  
- Full pipeline documentation: [docs/CV_PIPELINE.md](../docs/CV_PIPELINE.md).
