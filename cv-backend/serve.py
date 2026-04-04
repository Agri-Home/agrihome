#!/usr/bin/env python3
"""
FastAPI server: PlantVillage-trained classifier for AgriHome CV_SPECIES_INFERENCE_URL.

  export USE_CLAHE=1   # optional LAB CLAHE via OpenCV before torch preprocess
  python serve.py --checkpoint ./artifacts/best.pt --classes ./artifacts/classes.json --port 8765

AgriHome .env:
  CV_SPECIES_INFERENCE_URL=http://192.168.0.142:8765/v1/classify
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image
from torchvision import models, transforms

app = FastAPI(title="AgriHome PlantVillage CV", version="1.0.0")

_model: nn.Module | None = None
_classes: list[str] = []
_device = torch.device("cpu")
_transform = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ]
)


def split_plantvillage_label(name: str) -> dict[str, Any]:
    name = name.strip()
    if "___" in name:
        crop, rest = name.split("___", 1)
        crop_h = crop.replace("_", " ").strip()
        cond_h = rest.replace("_", " ").strip()
        while "  " in cond_h:
            cond_h = cond_h.replace("  ", " ")
        is_healthy = cond_h.lower() == "healthy"
        return {
            "commonName": crop_h,
            "cultivar": cond_h,
            "plantCondition": cond_h,
            "rawLabel": name,
            "isHealthy": is_healthy,
        }
    h = name.replace("_", " ").strip()
    return {
        "commonName": h,
        "cultivar": h,
        "plantCondition": h,
        "rawLabel": name,
        "isHealthy": None,
    }


def decode_image_bytes(image_bytes: bytes) -> Image.Image:
    use_clahe = os.environ.get("USE_CLAHE", "").lower() in ("1", "true", "yes")
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("OpenCV could not decode image bytes")
    if use_clahe:
        lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
        l_ch, a_ch, b_ch = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_ch = clahe.apply(l_ch)
        lab = cv2.merge([l_ch, a_ch, b_ch])
        bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def load_checkpoint(path: Path, classes_path: Path) -> None:
    global _model, _classes, _device

    _classes = json.loads(classes_path.read_text(encoding="utf-8"))
    if not isinstance(_classes, list) or not all(isinstance(c, str) for c in _classes):
        raise ValueError("classes.json must be a JSON array of strings")

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    ck = torch.load(path, map_location=_device, weights_only=False)
    num_classes = int(ck.get("num_classes", len(_classes)))
    m = models.resnet18(weights=None)
    m.fc = nn.Linear(m.fc.in_features, num_classes)
    m.load_state_dict(ck["model_state"])
    m.to(_device)
    m.eval()
    _model = m
    print(f"Loaded {path} on {_device} ({num_classes} classes)")


class ClassifyIn(BaseModel):
    imageBase64: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "classes": str(len(_classes))}


@app.post("/v1/classify")
def classify(body: ClassifyIn) -> dict[str, Any]:
    if _model is None or not _classes:
        raise HTTPException(503, "Model not loaded")

    try:
        raw = base64.b64decode(body.imageBase64)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Invalid base64: {e}") from e

    try:
        pil = decode_image_bytes(raw)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e

    x = _transform(pil).unsqueeze(0).to(_device)
    with torch.no_grad():
        logits = _model(x)
        prob = torch.softmax(logits, dim=1)[0]
        conf, idx = prob.max(dim=0)
        idx_i = int(idx.item())

    if idx_i < 0 or idx_i >= len(_classes):
        raise HTTPException(500, "Class index out of range")

    label = _classes[idx_i]
    out = split_plantvillage_label(label)
    out["identificationConfidence"] = float(conf.item())
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--checkpoint", type=Path, required=True)
    p.add_argument("--classes", type=Path, required=True)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    args = p.parse_args()

    load_checkpoint(args.checkpoint, args.classes)

    import uvicorn

    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
