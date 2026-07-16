"use client";
import { useState } from "react";
import Image from "next/image";
import { BlurhashCanvas } from "./blurhash-canvas";

/**
 * Ảnh cover chống CLS: khung aspect-ratio reserve chỗ TRƯỚC khi ảnh về
 * (CLS = 0 kể cả không có blurhash), blurhash canvas hiện tức thì phía dưới,
 * ảnh thật fade-in khi tải xong.
 */
export function CoverImage({
  src,
  alt,
  hash,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 768px",
  aspectClass = "aspect-[16/9]",
  className = "",
}: {
  src: string;
  alt: string;
  hash: string | null;
  priority?: boolean;
  sizes?: string;
  aspectClass?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-soft ${aspectClass} ${className}`}>
      <BlurhashCanvas hash={hash} />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        quality={75}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
