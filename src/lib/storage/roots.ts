import path from "path";

const cwd = process.cwd();

function resolveDir(explicit: string | undefined, underRoot: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return path.resolve(trimmed);
  }
  const root = process.env.STORAGE_ROOT?.trim();
  if (root) {
    return path.resolve(root, underRoot);
  }
  return path.join(cwd, "storage", underRoot);
}

/** Writable root for raw user leaf images (never overwrite in app code). */
export function getOriginalsRoot(): string {
  return resolveDir(process.env.STORAGE_ORIGINALS_DIR, "originals");
}

/** Resized / thumbnails / preprocessed images (future). */
export function getProcessedRoot(): string {
  return resolveDir(process.env.STORAGE_PROCESSED_DIR, "processed");
}

/** Short-lived upload / inference scratch (safe to clean). */
export function getTempRoot(): string {
  return resolveDir(process.env.STORAGE_TEMP_DIR, "temp");
}

export type StorageKind = "originals" | "processed" | "temp";

export function getRootForKind(kind: StorageKind): string {
  if (kind === "originals") {
    return getOriginalsRoot();
  }
  if (kind === "processed") {
    return getProcessedRoot();
  }
  return getTempRoot();
}
