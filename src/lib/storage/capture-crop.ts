import { env } from "@/lib/config/env";

export type CaptureCropMode = "center" | "leaf" | "off";

/**
 * Parse DEVICE_CAPTURE_CROP / AGRIHOME_CAPTURE_CROP style values.
 * Accepts: center | leaf | off | 0.65 | center:0.65
 */
export function parseCaptureCropMode(
  raw: string | undefined,
  fallback: CaptureCropMode = "center"
): CaptureCropMode {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const mode = raw.trim().toLowerCase();
  if (
    mode === "0" ||
    mode === "false" ||
    mode === "no" ||
    mode === "off" ||
    mode === "none" ||
    mode === "disable" ||
    mode === "disabled"
  ) {
    return "off";
  }
  if (mode.startsWith("leaf")) {
    return "leaf";
  }
  if (mode.startsWith("center") || /^[\d.]+$/.test(mode)) {
    return "center";
  }
  return fallback;
}

export function parseCaptureCropFraction(
  raw: string | undefined,
  cropModeRaw?: string,
  fallback = 0.6
): number {
  let value = raw;
  if ((value === undefined || value.trim() === "") && cropModeRaw) {
    const crop = cropModeRaw.trim().toLowerCase();
    if (crop.includes(":")) {
      value = crop.split(":", 2)[1]?.trim();
    } else if (/^[\d.]+$/.test(crop)) {
      value = crop;
    }
  }
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const frac = Number(value);
  if (!Number.isFinite(frac) || frac < 0.2 || frac > 1) {
    return fallback;
  }
  return frac;
}

type CropBox = { left: number; top: number; width: number; height: number };

function centerSquareBox(
  width: number,
  height: number,
  fraction: number
): CropBox {
  const side = Math.max(
    1,
    Math.min(width, height, Math.round(Math.min(width, height) * fraction))
  );
  return {
    left: Math.max(0, Math.floor((width - side) / 2)),
    top: Math.max(0, Math.floor((height - side) / 2)),
    width: side,
    height: side
  };
}

/**
 * Best-effort green-leaf ROI via a downscaled RGB mask. Returns null so
 * callers fall back to center crop (no ML leaf segmenter in-repo).
 */
async function leafSaliencyBox(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharpInstance: any,
  width: number,
  height: number,
  fraction: number
): Promise<CropBox | null> {
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const { data, info } = await sharpInstance
    .clone()
    .resize(sw, sh)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels as number;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * channels;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const val = max / 255;
      if (g > r + 15 && g > b + 10 && sat >= 0.15 && val >= 0.15) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < Math.max(80, Math.floor(info.width * info.height * 0.02))) {
    return null;
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const inv = scale > 0 ? 1 / scale : 1;
  let left = Math.floor(minX * inv);
  let top = Math.floor(minY * inv);
  let right = Math.ceil((maxX + 1) * inv);
  let bottom = Math.ceil((maxY + 1) * inv);
  const padX = Math.floor((right - left) * 0.15);
  const padY = Math.floor((bottom - top) * 0.15);
  left = Math.max(0, left - padX);
  top = Math.max(0, top - padY);
  right = Math.min(width, right + padX);
  bottom = Math.min(height, bottom + padY);
  const boxW = right - left;
  const boxH = bottom - top;
  if (boxW < 32 || boxH < 32 || boxW * boxH < width * height * 0.04) {
    return null;
  }
  let side = Math.max(boxW, boxH);
  const maxSidePx = Math.max(
    1,
    Math.round(Math.min(width, height) * Math.max(fraction, 0.85))
  );
  side = Math.min(side, maxSidePx, width, height);
  const cx = Math.floor((left + right) / 2);
  const cy = Math.floor((top + bottom) / 2);
  left = Math.max(0, Math.min(width - side, cx - Math.floor(side / 2)));
  top = Math.max(0, Math.min(height - side, cy - Math.floor(side / 2)));
  return { left, top, width: side, height: side };
}

/**
 * Center (or best-effort leaf) square crop for edge capture buffers.
 * Fail-soft: returns the original buffer on any error.
 *
 * Used for server-direct streamer captures and as an optional ingest safety net.
 * Pi agent / camera_server already crop before upload when updated.
 */
export async function cropCaptureImageBuffer(
  buffer: Buffer,
  options?: {
    mode?: CaptureCropMode;
    fraction?: number;
  }
): Promise<Buffer> {
  const mode = options?.mode ?? env.device.captureCrop;
  const fraction = options?.fraction ?? env.device.captureCropFraction;
  if (mode === "off" || fraction >= 0.999 || buffer.length === 0) {
    return buffer;
  }

  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(buffer, { failOn: "none" });
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < 2 || height < 2) {
      return buffer;
    }

    let box = centerSquareBox(width, height, fraction);
    if (mode === "leaf") {
      const leaf = await leafSaliencyBox(image, width, height, fraction);
      if (leaf) {
        box = leaf;
      }
    }
    if (box.width >= width && box.height >= height) {
      return buffer;
    }

    return await image
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height
      })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (err) {
    console.warn(
      "[capture-crop] crop failed; storing original frame",
      err instanceof Error ? err.message : err
    );
    return buffer;
  }
}
