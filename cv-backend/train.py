#!/usr/bin/env python3
"""
Train a PlantVillage multi-class model (crop + disease/healthy per folder name).

Expects ImageFolder layout like:
  raw/color/Tomato___Early_blight/*.jpg
  raw/color/Tomato___healthy/*.jpg
  ...

Example:
  python train.py --data-dir ../PlantVillage-Dataset/raw/color --epochs 20 --output-dir ./artifacts
"""

from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, models, transforms


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


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", type=Path, required=True, help="Path to PlantVillage raw/color")
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

    full = datasets.ImageFolder(root=str(args.data_dir), transform=train_tf)
    class_names = full.classes
    n_total = len(full)
    n_val = max(1, int(n_total * args.val_split))
    n_train = n_total - n_val
    gen = torch.Generator().manual_seed(args.seed)
    train_ds, val_ds = random_split(full, [n_train, n_val], generator=gen)

    # Validation uses deterministic transforms
    full_val = datasets.ImageFolder(root=str(args.data_dir), transform=val_tf)
    val_indices = val_ds.indices
    from torch.utils.data import Subset

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
