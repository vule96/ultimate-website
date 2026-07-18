"use client";

import { useEffect, useRef } from "react";

/**
 * Thanh tiến độ đọc mảnh ở đỉnh trang — dấu ấn của trải nghiệm đọc bài dài.
 *
 * Cập nhật MƯỢT: rAF gộp mọi scroll event thành tối đa 1 lần ghi/frame, và ghi
 * thẳng `transform: scaleX()` lên ref (GPU-composited, KHÔNG re-render React,
 * KHÔNG transition width gây layout/paint). Bản cũ dùng setState + `transition-[width]`
 * nên mỗi bước width phải animate 75ms → thanh trễ, "chỉ nhảy sau khi scroll xong".
 */
export function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = document.documentElement;
    const write = () => {
      rafRef.current = null;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(write);
    };
    write(); // giá trị ban đầu (kể cả khi tải giữa trang)
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[4px] bg-transparent" aria-hidden>
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-accent will-change-transform"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  );
}
