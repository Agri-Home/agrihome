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
 * User uploads live under `/public/uploads`. The dev client bundle may not
 * receive full `images.localPatterns` for `next/image`, which throws. Raw
 * `<img>` avoids that; other plant images still use the optimizer.
 */
export function PlantImage({
  src,
  alt,
  fill,
  className,
  sizes,
  priority
}: PlantImageProps) {
  if (src.startsWith("/uploads/")) {
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
