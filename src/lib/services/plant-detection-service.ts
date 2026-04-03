import { createHash } from "crypto";

/**
 * Reference taxa for simulated on-device / edge identification.
 * A real deployment would call a vision classifier; here we derive a stable
 * pick from image bytes so the same photo always maps to the same species.
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

export interface PlantSpeciesDetection {
  commonName: string;
  cultivar: string;
  /** Model confidence for species / cultivar ID (simulated). */
  identificationConfidence: number;
}

export function detectPlantSpeciesFromImage(imageBytes: Buffer): PlantSpeciesDetection {
  const digest = createHash("sha256").update(imageBytes).digest();
  const i = digest[0] % SPECIES_CATALOG.length;
  const base = SPECIES_CATALOG[i];
  const jitter = (digest[1] / 255) * 0.08 - 0.04;
  const identificationConfidence = Math.min(0.97, Math.max(0.74, 0.86 + jitter));

  return {
    commonName: base.commonName,
    cultivar: base.cultivar,
    identificationConfidence: Math.round(identificationConfidence * 1000) / 1000
  };
}
