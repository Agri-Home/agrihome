"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

type PlantImageProps = {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
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
  priority
}: PlantImageProps) {
  if (src.startsWith("/uploads/") || src.startsWith("/api/files/")) {
    if (fill) {
      return (
        <img
          src={src}
          alt={alt}
          className={cn("absolute inset-0 h-full w-full object-cover", className)}
          decoding="async"
        />
      );
    }
    return (
      <img src={src} alt={alt} className={className} decoding="async" />
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
