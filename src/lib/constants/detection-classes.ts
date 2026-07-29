/**
 * Leaf classifier labels AgriHome trains from the combined leaf datasets:
 *
 *   plantvillage/raw/color  — PlantVillage (38 Crop___Condition folders)
 *   plantdoc/               — PlantDoc (mapped → PlantVillage labels)
 *   plant-leaf/             — supplemental leaf set (adds leafroll + powdery mildew)
 *
 * Folder → label mapping lives in cv-backend/dataset_label_map.json.
 * Runtime `classes.json` is produced by training; this module is the
 * marketing / UI catalog of what that combined training covers.
 */

/** PlantVillage `raw/color` class folders (38). */
export const PLANTVILLAGE_COLOR_CLASSES = [
  "Apple___Apple_scab",
  "Apple___Black_rot",
  "Apple___Cedar_apple_rust",
  "Apple___healthy",
  "Blueberry___healthy",
  "Cherry_(including_sour)___Powdery_mildew",
  "Cherry_(including_sour)___healthy",
  "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
  "Corn_(maize)___Common_rust_",
  "Corn_(maize)___Northern_Leaf_Blight",
  "Corn_(maize)___healthy",
  "Grape___Black_rot",
  "Grape___Esca_(Black_Measles)",
  "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
  "Grape___healthy",
  "Orange___Haunglongbing_(Citrus_greening)",
  "Peach___Bacterial_spot",
  "Peach___healthy",
  "Pepper,_bell___Bacterial_spot",
  "Pepper,_bell___healthy",
  "Potato___Early_blight",
  "Potato___Late_blight",
  "Potato___healthy",
  "Raspberry___healthy",
  "Soybean___healthy",
  "Squash___Powdery_mildew",
  "Strawberry___Leaf_scorch",
  "Strawberry___healthy",
  "Tomato___Bacterial_spot",
  "Tomato___Early_blight",
  "Tomato___Late_blight",
  "Tomato___Leaf_Mold",
  "Tomato___Septoria_leaf_spot",
  "Tomato___Spider_mites Two-spotted_spider_mite",
  "Tomato___Target_Spot",
  "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
  "Tomato___Tomato_mosaic_virus",
  "Tomato___healthy"
] as const;

/**
 * Extra targets present in `plant-leaf/` (not in the PlantVillage 38).
 * PlantDoc folders map entirely into PlantVillage labels.
 */
export const PLANT_LEAF_EXTRA_CLASSES = [
  "Potato___Leafroll_virus",
  "Tomato___Powdery_mildew"
] as const;

/** @deprecated Prefer PLANT_LEAF_EXTRA_CLASSES */
export const OPTIONAL_EXTRA_DETECTION_CLASSES = PLANT_LEAF_EXTRA_CLASSES;

/**
 * Full catalog the combined plantvillage + plantdoc + plant-leaf training covers.
 */
export const DETECTION_CLASSES = [
  ...PLANTVILLAGE_COLOR_CLASSES,
  ...PLANT_LEAF_EXTRA_CLASSES
] as const;

export const DETECTION_DATASET_SOURCES = [
  {
    id: "plantvillage",
    name: "PlantVillage",
    detail: "38 color leaf classes (raw/color)"
  },
  {
    id: "plantdoc",
    name: "PlantDoc",
    detail: "field photos mapped onto the same crop labels"
  },
  {
    id: "plant-leaf",
    name: "plant-leaf",
    detail: "adds potato leafroll virus and tomato powdery mildew"
  }
] as const;

export type DetectionClassLabel = (typeof DETECTION_CLASSES)[number];

/** Friendlier crop names for marketing / UI (raw labels stay canonical). */
const CROP_DISPLAY_NAMES: Record<string, string> = {
  "Cherry (including sour)": "Cherry",
  "Corn (maize)": "Corn",
  "Pepper, bell": "Bell pepper",
  Orange: "Orange / citrus"
};

/** Friendlier condition names when the raw folder string is noisy. */
const CONDITION_DISPLAY_NAMES: Record<string, string> = {
  "Haunglongbing (Citrus greening)": "Huanglongbing (citrus greening)",
  "Cercospora leaf spot Gray leaf spot": "Gray leaf spot",
  "Common rust": "Common rust",
  "Northern Leaf Blight": "Northern leaf blight",
  "Esca (Black Measles)": "Esca (black measles)",
  "Leaf blight (Isariopsis Leaf Spot)": "Leaf blight (Isariopsis)",
  "Spider mites Two-spotted spider mite": "Two-spotted spider mites",
  "Tomato Yellow Leaf Curl Virus": "Yellow leaf curl virus",
  "Tomato mosaic virus": "Mosaic virus",
  "Cedar apple rust": "Cedar apple rust",
  "Leafroll virus": "Leafroll virus",
  "Powdery mildew": "Powdery mildew"
};

function humanizeUnderscores(s: string): string {
  return s.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function splitDetectionClassLabel(rawLabel: string): {
  cropRaw: string;
  conditionRaw: string;
  cropDisplay: string;
  conditionDisplay: string;
  isHealthy: boolean;
} {
  const parts = rawLabel.split("___");
  const cropRaw = parts[0] ?? rawLabel;
  const conditionRaw = parts.length >= 2 ? parts.slice(1).join("___") : "";
  const cropHuman = humanizeUnderscores(cropRaw);
  const conditionHuman = humanizeUnderscores(conditionRaw);
  return {
    cropRaw,
    conditionRaw,
    cropDisplay: CROP_DISPLAY_NAMES[cropHuman] ?? cropHuman,
    conditionDisplay:
      CONDITION_DISPLAY_NAMES[conditionHuman] ??
      (conditionHuman || "Unknown"),
    isHealthy: conditionHuman.toLowerCase() === "healthy"
  };
}

export type DetectionClassGroup = {
  plant: string;
  conditions: string[];
};

/** Group detection classes by plant for scannable About / catalog UI. */
export function getDetectionClassesByPlant(
  labels: readonly string[] = DETECTION_CLASSES
): DetectionClassGroup[] {
  const byPlant = new Map<string, string[]>();

  for (const label of labels) {
    const { cropDisplay, conditionDisplay, isHealthy } =
      splitDetectionClassLabel(label);
    const list = byPlant.get(cropDisplay) ?? [];
    const name = isHealthy ? "Healthy" : conditionDisplay;
    if (!list.includes(name)) {
      list.push(name);
    }
    byPlant.set(cropDisplay, list);
  }

  return [...byPlant.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([plant, conditions]) => ({
      plant,
      conditions: [
        ...conditions.filter((c) => c === "Healthy"),
        ...conditions.filter((c) => c !== "Healthy").sort((a, b) => a.localeCompare(b))
      ]
    }));
}
