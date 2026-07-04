import { mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

import { getProcessedRoot } from "@/lib/storage/roots";
import { getStorageProvider } from "@/lib/storage/get-storage-provider";

const LIST_THUMB_MAX_PX = 256;

/** Thumbnails are normalized to JPEG under processed/ with the same relative path. */
export function processedThumbnailKey(originalsStorageKey: string): string {
  return originalsStorageKey.replace(/\.[^.]+$/, ".jpg");
}

/**
 * Map an originals URL to the matching processed thumbnail URL, if path-shaped.
 */
export function toProcessedImageUrl(originalUrl: string): string | null {
  const prefix = "/api/files/originals/";
  if (!originalUrl.startsWith(prefix)) {
    return null;
  }
  const rel = originalUrl.slice(prefix.length);
  return `/api/files/processed/${processedThumbnailKey(rel)}`;
}

/**
 * Write a list-view thumbnail under processed/.
 * Returns the processed URL on success, or null when generation fails.
 */
export async function writeListThumbnail(
  source: Buffer,
  processedStorageKey: string
): Promise<string | null> {
  try {
    const processedKey = processedStorageKey;
    const root = getProcessedRoot();
    const absolutePath = path.join(root, processedKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });

    await sharp(source)
      .rotate()
      .resize({
        width: LIST_THUMB_MAX_PX,
        height: LIST_THUMB_MAX_PX,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(absolutePath);

    return getStorageProvider().getUrl("processed", processedKey);
  } catch {
    return null;
  }
}
