import { randomUUID } from "crypto";
import path from "path";

import { getStorageProvider } from "@/lib/storage/get-storage-provider";
import { getOriginalsRoot } from "@/lib/storage/roots";
import { processedThumbnailKey, writeListThumbnail } from "@/lib/storage/thumbnail";

export type LeafImageExt = "jpg" | "png" | "webp";

/**
 * Persist a leaf image under originals/YYYY/MM/DD/<uuid>.<ext>.
 * Returns a browser URL served by GET /api/files/originals/...
 */
export async function savePlantLeafOriginal(
  buffer: Buffer,
  ext: LeafImageExt
): Promise<{
  imageUrl: string;
  absolutePath: string;
  bytes: number;
  mimeType: string;
  thumbnailUrl: string | null;
}> {
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const storageKey = `${y}/${m}/${d}/${filename}`;

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
    bytes: stored.bytes,
    mimeType,
    thumbnailUrl
  };
}
