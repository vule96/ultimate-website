import type { Post } from "@ultimate/types";

/** Chọn bài liên quan: bỏ bài đang đọc, lấy tối đa limit. */
export function pickRelated(candidates: Post[], currentSlug: string, limit = 3): Post[] {
  return candidates.filter((p) => p.slug !== currentSlug).slice(0, limit);
}
