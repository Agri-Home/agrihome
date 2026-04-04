import { env, hasSpeciesInferenceConfig } from "@/lib/config/env";

/**
 * Species / disease from a leaf image via `CV_SPECIES_INFERENCE_URL` (e.g. cv-backend
 * trained on PlantVillage). See docs/CV_PIPELINE.md.
 *
 * Dataset reference: https://github.com/spMohanty/PlantVillage-Dataset/tree/master/raw/color
 */
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

/**
 * Leaf image → crop + condition. Requires `CV_SPECIES_INFERENCE_URL` (no local simulator).
 */
export async function detectPlantSpeciesFromImage(
  imageBytes: Buffer
): Promise<PlantSpeciesDetection> {
  if (!hasSpeciesInferenceConfig) {
    throw new Error(
      "CV_SPECIES_INFERENCE_URL is required for species classification (see docs/CV_PIPELINE.md)."
    );
  }

  const url = env.cv.speciesInferenceUrl.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (env.cv.speciesInferenceApiKey) {
    headers.Authorization = `Bearer ${env.cv.speciesInferenceApiKey}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        imageBase64: imageBytes.toString("base64")
      }),
      signal: AbortSignal.timeout(60_000)
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Species classifier request failed: ${msg}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Species classifier HTTP ${res.status}: ${text.slice(0, 280)}`
    );
  }

  const body = (await res.json()) as RemoteSpeciesPayload;
  const parsed = parseRemoteSpecies(body);
  if (!parsed) {
    throw new Error(
      "Species classifier returned a response that could not be parsed."
    );
  }
  return parsed;
}
