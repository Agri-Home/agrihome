import fs from "fs";
import path from "path";

import {
  type StorageKind,
  getRootForKind
} from "@/lib/storage/roots";

const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Map URL segments after /api/files/ to an absolute file path, or null if invalid.
 * Blocks path traversal and unknown storage kinds.
 */
export function resolveStorageFilePath(segments: string[]): string | null {
  if (!segments.length) {
    return null;
  }
  const kind = segments[0] as StorageKind;
  if (kind !== "originals" && kind !== "processed" && kind !== "temp") {
    return null;
  }
  const rest = segments.slice(1);
  if (!rest.length) {
    return null;
  }
  for (const seg of rest) {
    if (!SEGMENT_RE.test(seg)) {
      return null;
    }
  }

  const root = path.resolve(getRootForKind(kind));
  const resolved = path.resolve(root, ...rest);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return null;
  }

  return resolved;
}

export function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".webp") {
    return "image/webp";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".gif") {
    return "image/gif";
  }
  if (ext === ".svg") {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}
