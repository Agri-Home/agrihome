"use client";

import { useState } from "react";
import Image from "next/image";

import { toProcessedImageUrl } from "@/lib/storage/thumbnail";
import { cn } from "@/lib/utils";

type PlantImageProps = {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** Use processed list thumbnail when available; falls back to the original on error. */
  preferThumbnail?: boolean;
};

/**
 * Leaf originals are served from `/api/files/originals/...` (disk outside
 * `public/`). Older rows may still use `/public/uploads/...`. Raw `<img>`
 * avoids `next/image` local pattern issues for those paths.
 */
export function PlantImage({
  src,
  alt,
  fill,
  className,
  sizes,
  priority,
  preferThumbnail = false
}: PlantImageProps) {
  const initialSrc =
    preferThumbnail && src.startsWith("/api/files/originals/")
      ? toProcessedImageUrl(src) ?? src
      : src;
  const [displaySrc, setDisplaySrc] = useState(initialSrc);
  const usingThumbnail =
    preferThumbnail && displaySrc !== src && displaySrc.startsWith("/api/files/processed/");

  if (src.startsWith("/uploads/") || src.startsWith("/api/files/")) {
    const handleError = () => {
      if (usingThumbnail) {
        setDisplaySrc(src);
      }
    };

    if (fill) {
      return (
        <img
          src={displaySrc}
          alt={alt}
          className={cn("absolute inset-0 h-full w-full object-cover", className)}
          decoding="async"
          onError={handleError}
        />
      );
    }
    return (
      <img
        src={displaySrc}
        alt={alt}
        className={className}
        decoding="async"
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
