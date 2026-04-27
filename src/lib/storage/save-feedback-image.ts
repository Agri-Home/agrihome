import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { getOriginalsRoot } from "@/lib/storage/roots";

export type FeedbackImageExt = "jpg" | "png" | "webp";

/**
 * Persist feedback images under originals/feedback/YYYY/MM/DD/<id>.<ext>.
 * Served at GET /api/files/originals/feedback/...
 * @param filenameBase - Optional stable id (e.g. feedback row id) instead of a random UUID.
 */
export async function saveFeedbackImageLocal(
  buffer: Buffer,
  ext: FeedbackImageExt,
  options?: { filenameBase?: string }
): Promise<{
  imageUrl: string;
  absolutePath: string;
  storageKey: string;
  mimeType: string;
}> {
  const root = getOriginalsRoot();
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const base = options?.filenameBase?.trim() || randomUUID();
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${safeBase}.${ext}`;
  const dir = path.join(root, "feedback", y, m, d);
  await mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, buffer);

  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

  const storageKey = `feedback/${y}/${m}/${d}/${filename}`;
  const imageUrl = `/api/files/originals/feedback/${y}/${m}/${d}/${filename}`;

  return {
    imageUrl,
    absolutePath,
    storageKey,
    mimeType
  };
}
