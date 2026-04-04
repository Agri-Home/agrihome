import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { getOriginalsRoot } from "@/lib/storage/roots";

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
}> {
  const root = getOriginalsRoot();
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const dir = path.join(root, y, m, d);
  await mkdir(dir, { recursive: true });
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, buffer);

  const mimeType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

  const imageUrl = `/api/files/originals/${y}/${m}/${d}/${filename}`;

  return {
    imageUrl,
    absolutePath,
    bytes: buffer.length,
    mimeType
  };
}
