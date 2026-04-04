#!/usr/bin/env python3
"""
Train a multi-class plant leaf model (Crop___Condition labels, PlantVillage-style).

Primary data: PlantVillage ImageFolder layout:
  raw/color/Tomato___Early_blight/*.jpg
  ...

Optional extra roots (e.g. PlantDoc / plant-leaf-dataset **train/** folders) are mapped to the
same canonical labels via dataset_label_map.json next to this script.

Example:
  python train.py --data-dir ../PlantVillage-Dataset/raw/color \\
    --extra-dataset plantdoc=../PlantDoc-Dataset/train \\
    --extra-dataset plant_leaf=../plant-leaf-dataset/train \\
    --epochs 20 --output-dir ./artifacts
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset, Subset, random_split
from torchvision import models, transforms
from torchvision.datasets.folder import IMG_EXTENSIONS

_IMAGE_EXT = tuple(ext.lower() for ext in IMG_EXTENSIONS)


def set_seed(seed: int) -> None:
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def build_model(num_classes: int) -> nn.Module:
    m = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    in_f = m.fc.in_features
    m.fc = nn.Linear(in_f, num_classes)
    return m


def load_label_map(path: Path) -> dict[str, dict[str, str]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError(f"Label map must be a JSON object: {path}")
    out: dict[str, dict[str, str]] = {}
    for k, v in raw.items():
        if isinstance(v, dict):
            out[str(k)] = {str(a): str(b) for a, b in v.items()}
    return out


def _iter_class_images(root: Path) -> list[tuple[Path, str]]:
    """List (image_path, folder_name) for one ImageFolder-style root."""
    found: list[tuple[Path, str]] = []
    if not root.is_dir():
        return found
    for class_dir in sorted(root.iterdir()):
        if not class_dir.is_dir():
            continue
        name = class_dir.name
        for p in sorted(class_dir.iterdir()):
            if p.is_file() and p.suffix.lower() in _IMAGE_EXT:
                found.append((p, name))
    return found


def collect_plantvillage(root: Path) -> list[tuple[str, str]]:
    """Return list of (path_str, canonical_label)."""
    rows: list[tuple[str, str]] = []
    for p, folder in _iter_class_images(root):
        rows.append((str(p), folder))
    return rows


def collect_mapped(
    root: Path,
    source_key: str,
    mappers: dict[str, dict[str, str]],
    strict: bool,
) -> list[tuple[str, str]]:
    table = mappers.get(source_key)
    if not table:
        raise SystemExit(f"Unknown extra-dataset source {source_key!r}; known: {sorted(mappers)}")
    rows: list[tuple[str, str]] = []
    missing: list[str] = []
    for p, folder in _iter_class_images(root):
        canon = table.get(folder)
        if canon is None:
            missing.append(folder)
            continue
        rows.append((str(p), canon))
    missing_u = sorted(set(missing))
    if missing_u:
        msg = f"Unmapped class folders under {root} ({source_key}): {missing_u}"
        if strict:
            raise SystemExit(msg + "\nFix dataset_label_map.json or use --no-strict-extra-dataset to skip.")
        print(f"WARNING: {msg} — skipping those folders.")
    return rows


class ImagePathDataset(Dataset):
    def __init__(self, samples: list[tuple[str, int]], transform: Any) -> None:
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, i: int) -> tuple[Any, int]:
        path, y = self.samples[i]
        img = Image.open(path).convert("RGB")
        if self.transform is not None:
            img = self.transform(img)
        return img, y


def parse_extra_dataset(spec: str) -> tuple[str, Path]:
    if "=" not in spec:
        raise SystemExit(
            f"Invalid --extra-dataset {spec!r}; use SOURCE=PATH "
            f"(e.g. plantdoc=/data/PlantDoc-Dataset/train)"
        )
    key, path = spec.split("=", 1)
    key = key.strip()
    path = path.strip()
    if not key or not path:
        raise SystemExit(f"Invalid --extra-dataset {spec!r}")
    return key, Path(path).expanduser().resolve()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", type=Path, required=True, help="PlantVillage raw/color (ImageFolder)")
    p.add_argument(
        "--extra-dataset",
        action="append",
        default=[],
        metavar="SOURCE=PATH",
        help="Additional ImageFolder root, e.g. plantdoc=.../PlantDoc-Dataset/train",
    )
    p.add_argument(
        "--label-map",
        type=Path,
        default=None,
        help="JSON map of external folder names → PlantVillage-style labels (default: dataset_label_map.json)",
    )
    p.add_argument(
        "--strict-extra-dataset",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Exit if an extra dataset has folders not in the label map (default: true)",
    )
    p.add_argument("--output-dir", type=Path, default=Path("artifacts"))
    p.add_argument("--epochs", type=int, default=15)
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--val-split", type=float, default=0.1)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--num-workers", type=int, default=4)
    args = p.parse_args()

    set_seed(args.seed)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    script_dir = Path(__file__).resolve().parent
    map_path = args.label_map or (script_dir / "dataset_label_map.json")
    if not map_path.is_file():
        raise SystemExit(f"Label map not found: {map_path}")
    mappers = load_label_map(map_path)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    train_tf = transforms.Compose(
        [
            transforms.Resize((256, 256)),
            transforms.RandomResizedCrop(224, scale=(0.85, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(0.08, 0.08, 0.08, 0.02),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )
    val_tf = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    data_dir = args.data_dir.expanduser().resolve()
    if not data_dir.is_dir():
        raise SystemExit(f"--data-dir is not a directory: {data_dir}")

    split_folder_names = {"color", "grayscale", "segmented"}
    pv_rows = collect_plantvillage(data_dir)
    if not pv_rows:
        raise SystemExit(f"No images found under {data_dir} (expect class subfolders).")
    pv_labels = {lbl for _, lbl in pv_rows}
    bad = split_folder_names.intersection(pv_labels)
    if bad:
        print(
            "ERROR: --data-dir looks like PlantVillage **raw/** (split folders) instead of **raw/color/**.\n"
            f"  Found class folder(s): {sorted(bad)} — expected names like Tomato___healthy.\n"
            "  Use: --data-dir .../PlantVillage-Dataset/raw/color"
        )
        raise SystemExit(1)
    if len(pv_labels) < 15 and not any("___" in n for n in pv_labels):
        print(
            f"WARNING: Only {len(pv_labels)} classes and none use '___' (Crop___Condition). "
            "Full PlantVillage color has ~38 folders. Check --data-dir."
        )

    all_rows: list[tuple[str, str]] = list(pv_rows)
    for spec in args.extra_dataset:
        src_key, root = parse_extra_dataset(spec)
        strict = args.strict_extra_dataset
        extra = collect_mapped(root, src_key, mappers, strict=strict)
        print(f"Extra dataset {src_key} @ {root}: {len(extra)} images")
        all_rows.extend(extra)

    class_names = sorted({lbl for _, lbl in all_rows})
    class_to_idx = {c: i for i, c in enumerate(class_names)}
    indexed = [(path, class_to_idx[lbl]) for path, lbl in all_rows]

    print(f"Total images: {len(indexed)}  classes: {len(class_names)}")

    full_train = ImagePathDataset(indexed, transform=train_tf)
    n_total = len(full_train)
    n_val = max(1, int(n_total * args.val_split))
    n_train = n_total - n_val
    gen = torch.Generator().manual_seed(args.seed)
    train_ds, val_ds = random_split(full_train, [n_train, n_val], generator=gen)

    full_val = ImagePathDataset(indexed, transform=val_tf)
    val_indices = val_ds.indices
    val_subset = Subset(full_val, val_indices)

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
    )
    val_loader = DataLoader(
        val_subset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
    )

    num_classes = len(class_names)
    model = build_model(num_classes).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs))
    criterion = nn.CrossEntropyLoss()

    classes_path = args.output_dir / "classes.json"
    classes_path.write_text(json.dumps(class_names, indent=2), encoding="utf-8")
    print(f"Wrote {classes_path} ({num_classes} classes)")

    best_acc = 0.0
    best_path = args.output_dir / "best.pt"

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        n_seen = 0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            opt.zero_grad(set_to_none=True)
            logits = model(x)
            loss = criterion(logits, y)
            loss.backward()
            opt.step()
            running += loss.item() * x.size(0)
            n_seen += x.size(0)
        sched.step()

        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                pred = model(x).argmax(dim=1)
                correct += (pred == y).sum().item()
                total += y.size(0)
        acc = correct / max(1, total)
        print(f"Epoch {epoch}/{args.epochs}  train_loss={running/n_seen:.4f}  val_acc={acc:.4f}")

        if acc >= best_acc:
            best_acc = acc
            torch.save(
                {
                    "model_state": model.state_dict(),
                    "num_classes": num_classes,
                    "arch": "resnet18",
                },
                best_path,
            )
            print(f"  saved {best_path} (val_acc={best_acc:.4f})")

    print(f"Done. Best val_acc={best_acc:.4f}  checkpoint={best_path}")


if __name__ == "__main__":
    main()
