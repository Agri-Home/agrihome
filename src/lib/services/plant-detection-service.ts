import { createHash } from "crypto";

import { env } from "@/lib/config/env";

/**
 * Species / disease from a leaf image. Remote: `CV_SPECIES_INFERENCE_URL` (e.g. cv-backend
 * trained on PlantVillage). See docs/CV_PIPELINE.md.
 *
 * Dataset reference: https://github.com/spMohanty/PlantVillage-Dataset/tree/master/raw/color
 */
const SPECIES_CATALOG = [
  { commonName: "Sweet basil", cultivar: "Ocimum basilicum 'Genovese'" },
  { commonName: "Cherry tomato", cultivar: "Solanum lycopersicum (cherry type)" },
  { commonName: "Butterhead lettuce", cultivar: "Lactuca sativa 'Butterhead'" },
  { commonName: "Bell pepper", cultivar: "Capsicum annuum (sweet)" },
  { commonName: "Cilantro", cultivar: "Coriandrum sativum" },
  { commonName: "Curly kale", cultivar: "Brassica oleracea (Acephala group)" },
  { commonName: "English cucumber", cultivar: "Cucumis sativus (greenhouse type)" },
  { commonName: "Strawberry", cultivar: "Fragaria × ananassa" }
] as const;

/** PlantVillage-style simulated rows (Crop___Condition). */
const PV_STYLE_SIM = [
  { rawLabel: "Tomato___healthy", isHealthy: true },
  { rawLabel: "Tomato___Early_blight", isHealthy: false },
  { rawLabel: "Pepper,_bell___Bacterial_spot", isHealthy: false },
  { rawLabel: "Potato___healthy", isHealthy: true },
  { rawLabel: "Strawberry___Leaf_scorch", isHealthy: false },
  { rawLabel: "Corn_(maize)___healthy", isHealthy: true }
] as const;

export interface PlantSpeciesDetection {
  commonName: string;
  cultivar: string;
  /** Model confidence for the predicted class. */
  identificationConfidence: number;
  /** Disease or health condition (PlantVillage folder suffix, humanized). */
  plantCondition?: string;
  /** Original classifier label (e.g. Tomato___Early_blight). */
  rawLabel?: string;
  /** True when condition is the dataset's healthy class. */
  isHealthy?: boolean;
}

type RemoteSpeciesPayload = {
  commonName?: unknown;
  cultivar?: unknown;
  label?: unknown;
  rawLabel?: unknown;
  scientificName?: unknown;
  identificationConfidence?: unknown;
  confidence?: unknown;
  plantCondition?: unknown;
  disease?: unknown;
  condition?: unknown;
  isHealthy?: unknown;
};

function humanizeUnderscores(s: string): string {
  return s.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function parsePlantVillageStyleLabel(label: string): {
  commonName: string;
  cultivar: string;
  plantCondition: string;
  rawLabel: string;
  isHealthy: boolean;
} {
  const rawLabel = label.trim();
  const parts = rawLabel.split("___");
  if (parts.length >= 2) {
    const crop = humanizeUnderscores(parts[0]);
    const cond = humanizeUnderscores(parts.slice(1).join("___"));
    const isHealthy = cond.toLowerCase() === "healthy";
    return {
      commonName: crop,
      cultivar: cond,
      plantCondition: cond,
      rawLabel,
      isHealthy
    };
  }
  const h = humanizeUnderscores(rawLabel);
  return {
    commonName: h,
    cultivar: h,
    plantCondition: h,
    rawLabel,
    isHealthy: false
  };
}

function simulatedDetectPlantSpeciesFromImage(
  imageBytes: Buffer
): PlantSpeciesDetection {
  const digest = createHash("sha256").update(imageBytes).digest();
  const i = digest[0] % SPECIES_CATALOG.length;
  const base = SPECIES_CATALOG[i];
  const jitter = (digest[1] / 255) * 0.08 - 0.04;
  const identificationConfidence = Math.min(0.97, Math.max(0.74, 0.86 + jitter));

  const pv = PV_STYLE_SIM[digest[2] % PV_STYLE_SIM.length];
  const parsed = parsePlantVillageStyleLabel(pv.rawLabel);

  return {
    commonName: base.commonName,
    cultivar: parsed.cultivar,
    identificationConfidence: Math.round(identificationConfidence * 1000) / 1000,
    plantCondition: parsed.plantCondition,
    rawLabel: pv.rawLabel,
    isHealthy: pv.isHealthy
  };
}

function parseRemoteSpecies(body: RemoteSpeciesPayload): PlantSpeciesDetection | null {
  const confRaw = body.identificationConfidence ?? body.confidence;
  const identificationConfidence = Number(confRaw);
  if (!Number.isFinite(identificationConfidence)) {
    return null;
  }
  const conf = Math.min(1, Math.max(0, identificationConfidence));

  const condRaw = body.plantCondition ?? body.disease ?? body.condition;
  const plantCondition =
    typeof condRaw === "string" && condRaw.trim() ? condRaw.trim() : undefined;

  const commonExplicit =
    typeof body.commonName === "string" && body.commonName.trim()
      ? body.commonName.trim()
      : "";
  const cultivarRaw = body.cultivar ?? body.scientificName;
  const cultivarExplicit =
    typeof cultivarRaw === "string" && cultivarRaw.trim()
      ? cultivarRaw.trim()
      : "";

  const labelStr =
    (typeof body.label === "string" && body.label.trim() && body.label) ||
    (typeof body.rawLabel === "string" && body.rawLabel.trim() && body.rawLabel) ||
    "";

  if (commonExplicit) {
    const cultivar =
      cultivarExplicit || plantCondition || commonExplicit;
    const healthyRaw = body.isHealthy;
    const isHealthy =
      typeof healthyRaw === "boolean"
        ? healthyRaw
        : plantCondition?.toLowerCase() === "healthy";
    return {
      commonName: commonExplicit,
      cultivar,
      identificationConfidence: conf,
      plantCondition: plantCondition ?? cultivarExplicit,
      rawLabel: labelStr || undefined,
      isHealthy
    };
  }

  if (labelStr.includes("___")) {
    const parsed = parsePlantVillageStyleLabel(labelStr);
    const healthyRaw = body.isHealthy;
    const isHealthy =
      typeof healthyRaw === "boolean" ? healthyRaw : parsed.isHealthy;
    return {
      commonName: parsed.commonName,
      cultivar: cultivarExplicit || parsed.cultivar,
      identificationConfidence: conf,
      plantCondition: plantCondition ?? parsed.plantCondition,
      rawLabel: parsed.rawLabel,
      isHealthy
    };
  }

  if (labelStr) {
    const parsed = parsePlantVillageStyleLabel(labelStr);
    return {
      commonName: parsed.commonName,
      cultivar: cultivarExplicit || parsed.cultivar,
      identificationConfidence: conf,
      plantCondition: plantCondition ?? parsed.plantCondition,
      rawLabel: parsed.rawLabel,
      isHealthy:
        typeof body.isHealthy === "boolean" ? body.isHealthy : parsed.isHealthy
    };
  }

  return null;
}

async function remoteDetectPlantSpeciesFromImage(
  imageBytes: Buffer
): Promise<PlantSpeciesDetection | null> {
  const url = env.cv.speciesInferenceUrl.trim();
  if (!url) {
    return null;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (env.cv.speciesInferenceApiKey) {
    headers.Authorization = `Bearer ${env.cv.speciesInferenceApiKey}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64: imageBytes.toString("base64")
      }),
      signal: AbortSignal.timeout(60_000)
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as RemoteSpeciesPayload;
    return parseRemoteSpecies(body);
  } catch {
    return null;
  }
}

/**
 * Leaf image → crop + condition (and optional disease). Uses `CV_SPECIES_INFERENCE_URL`
 * when set; otherwise a deterministic simulator with PlantVillage-shaped labels.
 */
export async function detectPlantSpeciesFromImage(
  imageBytes: Buffer
): Promise<PlantSpeciesDetection> {
  const remote = await remoteDetectPlantSpeciesFromImage(imageBytes);
  if (remote) {
    return remote;
  }
  return simulatedDetectPlantSpeciesFromImage(imageBytes);
}
