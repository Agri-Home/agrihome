import { randomUUID } from "crypto";
import path from "path";

import { getStorageProvider } from "@/lib/storage/get-storage-provider";
import { getOriginalsRoot } from "@/lib/storage/roots";
import { processedThumbnailKey, writeListThumbnail } from "@/lib/storage/thumbnail";

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
  thumbnailUrl: string | null;
}> {
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const base = options?.filenameBase?.trim() || randomUUID();
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${safeBase}.${ext}`;
  const storageKey = `feedback/${y}/${m}/${d}/${filename}`;

  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

  const provider = getStorageProvider();
  const stored = await provider.put("originals", storageKey, buffer, mimeType);
  const thumbnailUrl = await writeListThumbnail(buffer, processedThumbnailKey(storageKey));

  return {
    imageUrl: stored.url,
    absolutePath: path.join(getOriginalsRoot(), storageKey),
    storageKey,
    mimeType,
    thumbnailUrl
  };
}
