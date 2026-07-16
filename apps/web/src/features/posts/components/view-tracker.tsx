"use client";
import { useEffect } from "react";
import { PUBLIC_API_URL } from "@/lib/config";

/**
 * Bắn 1 view khi trang bài viết mount — fire-and-forget:
 * sendBeacon (không block navigation) → fallback fetch keepalive; lỗi nuốt im
 * lặng (đếm view không được phép ảnh hưởng trải nghiệm đọc).
 * Core gom batch (202) — xem posts.ViewCounter.
 */
export function ViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    const url = `${PUBLIC_API_URL}/api/v1/posts/${postId}/view`;
    try {
      if (navigator.sendBeacon?.(url)) return;
      void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    } catch {
      // im lặng — beacon là best-effort
    }
  }, [postId]);
  return null;
}
