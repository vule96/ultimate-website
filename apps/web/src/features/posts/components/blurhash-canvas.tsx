"use client";
import { useEffect, useRef } from "react";
import { decode } from "blurhash";

// Độ phân giải decode — 32px đủ mượt cho placeholder, CSS scale lên full khung.
const SIZE = 32;

/**
 * Vẽ blurhash lên canvas làm placeholder ảnh (hiện tức thì, ~30 bytes data).
 * hash null/decode lỗi → không render gì (caller lo nền fallback).
 */
export function BlurhashCanvas({ hash, className }: { hash: string | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!hash || !ref.current) return;
    try {
      const pixels = decode(hash, SIZE, SIZE);
      const ctx = ref.current.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(SIZE, SIZE);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // hash rác → bỏ qua, giữ nền fallback
    }
  }, [hash]);

  if (!hash) return null;
  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      aria-hidden="true"
      className={className ?? "absolute inset-0 h-full w-full"}
    />
  );
}
