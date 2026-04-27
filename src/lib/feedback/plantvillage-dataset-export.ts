import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * Optional second copy of each feedback image in the same layout that
 * `cv-backend/train.py` expects for `--data-dir` (torchvision ImageFolder):
 *
 *   <root>/Tomato___Early_blight/img001.jpg
 *   <root>/Tomato___healthy/img002.jpg
 *   ...
 *
 * `<root>` must be the **color** split only — i.e. the same directory you would pass as
 * `../PlantVillage-Dataset/raw/color`, **not** the parent `raw/` folder (which has
 * `color` / `grayscale` / `segmented` and would be mis-detected as class names).
 *
 * Set `PLANTVILLAGE_FEEDBACK_DATASET_DIR` to that root. We write:
 *   `<root>/<ClassFolder>/<feedbackId>.<ext>`
 *
 * Class folder names should match PlantVillage convention `Crop___Condition` (e.g.
 * `Tomato___Early_blight`). Use `PLANTVILLAGE_FEEDBACK_FOLDER_MAP` to map UI strings
 * to those names. Unmapped labels become `Agrihome___...` folders; to fold those into
 * canonical classes when training alongside the main dataset, use
 * `python train.py --data-dir .../raw/color --extra-dataset agrihome=<this root>` and
 * add an `agrihome` entry in `cv-backend/dataset_label_map.json` (same idea as
 * `plantdoc` / `plant_leaf` in that file).
 */

const MAP_CACHE: { map: Record<string, string> | null } = { map: null };

function loadFolderMapFromEnv(): Record<string, string> {
  if (MAP_CACHE.map) {
    return MAP_CACHE.map;
  }
  const raw = process.env.PLANTVILLAGE_FEEDBACK_FOLDER_MAP?.trim();
  if (!raw) {
    MAP_CACHE.map = {};
    return MAP_CACHE.map;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      MAP_CACHE.map = Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v)
        ])
      );
      return MAP_CACHE.map;
    }
  } catch {
    // ignore
  }
  MAP_CACHE.map = {};
  return MAP_CACHE.map;
}

/**
 * One path segment only: [A-Za-z0-9_]+, triple-underscore like Crop___Condition allowed.
 */
function sanitizeClassFolderName(name: string): string {
  const s = name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const out = s.slice(0, 120);
  return out || "Agrihome___unlabeled";
}

function slugToken(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Resolves the ImageFolder class directory name for this sample.
 * Priority: map[exact category] → map[first tag] → Agrihome___<slug(category)> → Agrihome___<slug(first tag)> → Agrihome___unlabeled
 */
export function resolvePlantVillageClassFolderName(
  feedbackCategory: string | null,
  feedbackTags: string[]
): string {
  const map = loadFolderMapFromEnv();
  const cat = feedbackCategory?.trim() ?? "";
  if (cat && map[cat]) {
    return sanitizeClassFolderName(map[cat]!);
  }
  if (cat) {
    return sanitizeClassFolderName(`Agrihome___${slugToken(cat) || "unlabeled"}`);
  }
  const t0 = feedbackTags[0]?.trim() ?? "";
  if (t0 && map[t0]) {
    return sanitizeClassFolderName(map[t0]!);
  }
  if (t0) {
    return sanitizeClassFolderName(`Agrihome___${slugToken(t0) || "unlabeled"}`);
  }
  return "Agrihome___unlabeled";
}

export function getPlantVillageFeedbackDatasetRootFromEnv(): string | null {
  const d = process.env.PLANTVILLAGE_FEEDBACK_DATASET_DIR?.trim();
  return d ? path.resolve(d) : null;
}

export type PlantVillageWriteResult = {
  classFolder: string;
  /** Relative to PLANTVILLAGE_FEEDBACK_DATASET_DIR using / separators. */
  relpath: string;
  absolutePath: string;
};

/**
 * Write a copy of the image for offline training. No-op (returns null) if env dir unset.
 */
export async function writeFeedbackImageToPlantVillageLayout(input: {
  buffer: Buffer;
  ext: string;
  feedbackId: string;
  classFolder: string;
}): Promise<PlantVillageWriteResult | null> {
  const root = getPlantVillageFeedbackDatasetRootFromEnv();
  if (!root) {
    return null;
  }

  const safeFolder = path.basename(input.classFolder);
  if (!safeFolder || safeFolder === "." || safeFolder === "..") {
    throw new Error("Invalid class folder name");
  }

  const safeId = input.feedbackId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = input.ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filename = `${safeId}.${ext}`;

  const classDir = path.join(root, safeFolder);
  await mkdir(classDir, { recursive: true });
  const absolutePath = path.join(classDir, filename);
  await writeFile(absolutePath, input.buffer);

  const relpath = `${safeFolder}/${filename}`.replace(/\\/g, "/");
  return {
    classFolder: safeFolder,
    relpath,
    absolutePath
  };
}
