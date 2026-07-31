import sharp from "sharp";

import { env } from "@/lib/config/env";

export type CaptureCropMode = "center" | "leaf" | "off";
export type CaptureRotationDegrees = 0 | 90 | 180 | 270;

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

export function parseCaptureRotation(
  raw: string | undefined,
  fallback: CaptureRotationDegrees = 180
): CaptureRotationDegrees {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const deg = Number(raw.trim());
  if (deg === 0 || deg === 90 || deg === 180 || deg === 270) {
    return deg;
  }
  return fallback;
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
  image: ReturnType<typeof sharp>,
  width: number,
  height: number,
  fraction: number
): Promise<CropBox | null> {
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));
  const { data, info } = await image
    .clone()
    .resize(sw, sh)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
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
 * Server-side capture framing for raw stills (streamer / fswebcam).
 *
 * Order: decode → rotate (DEVICE_CAPTURE_ROTATION) → center/leaf crop → JPEG.
 * Camserver /photo already applies rotate+crop; raspberry-pi ingest skips this
 * when imagePrepared=camera_server (or notes contain camera_photo).
 *
 * Fail-soft: returns the original buffer on any error.
 */
export async function prepareCaptureImageBuffer(
  buffer: Buffer,
  options?: {
    rotation?: CaptureRotationDegrees;
    mode?: CaptureCropMode;
    fraction?: number;
  }
): Promise<Buffer> {
  const rotation = options?.rotation ?? env.device.captureRotation;
  const mode = options?.mode ?? env.device.captureCrop;
  const fraction = options?.fraction ?? env.device.captureCropFraction;
  const cropEnabled = mode !== "off" && fraction < 0.999;

  if (buffer.length === 0 || (rotation === 0 && !cropEnabled)) {
    return buffer;
  }

  try {
    // Materialize after rotate so crop boxes use upright pixel dimensions.
    let pipeline = sharp(buffer, { failOn: "none" });
    if (rotation !== 0) {
      pipeline = pipeline.rotate(rotation);
    } else {
      // Apply EXIF Orientation when no mount correction is configured.
      pipeline = pipeline.rotate();
    }

    const { data: rotatedBytes, info } = await pipeline
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });

    const width = info.width ?? 0;
    const height = info.height ?? 0;
    if (width < 2 || height < 2) {
      return rotatedBytes;
    }

    if (!cropEnabled) {
      return rotatedBytes;
    }

    const upright = sharp(rotatedBytes, { failOn: "none" });
    let box = centerSquareBox(width, height, fraction);
    if (mode === "leaf") {
      const leaf = await leafSaliencyBox(upright, width, height, fraction);
      if (leaf) {
        box = leaf;
      }
    }
    if (box.width >= width && box.height >= height) {
      return rotatedBytes;
    }

    return await upright
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
      "[capture-crop] prepare (rotate/crop) failed; storing original frame",
      err instanceof Error ? err.message : err
    );
    return buffer;
  }
}

/**
 * @deprecated Prefer {@link prepareCaptureImageBuffer} (rotate + crop).
 * Crop-only helper kept for callers that already corrected orientation.
 */
export async function cropCaptureImageBuffer(
  buffer: Buffer,
  options?: {
    mode?: CaptureCropMode;
    fraction?: number;
  }
): Promise<Buffer> {
  return prepareCaptureImageBuffer(buffer, {
    rotation: 0,
    mode: options?.mode,
    fraction: options?.fraction
  });
}
