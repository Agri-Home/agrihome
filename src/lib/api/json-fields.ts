import type { PlantHealthStatus } from "@/lib/types/domain";

const PLANT_STATUSES: PlantHealthStatus[] = ["healthy", "watch", "alert"];

export function optTrimmedString(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  if (v === null) return undefined;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export function optNullableString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? null : t;
}

export function optInt(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.floor(n) : undefined;
  }
  return undefined;
}

export function optPlantStatus(v: unknown): PlantHealthStatus | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return undefined;
  return PLANT_STATUSES.includes(v as PlantHealthStatus)
    ? (v as PlantHealthStatus)
    : undefined;
}
