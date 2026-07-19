import {
  Grid,
  Code,
  Sparkles,
  CircleDollarSign,
  BarChart3,
  Compass,
  Landmark,
  PlayCircle,
  Newspaper,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import type { Category, CategoryKey } from "./types";

const ACCENT = "#0f6e63";

// Bảng màu muối/trầm (Slice 16): giữ hue = giữ nhận diện, hạ saturation ~40%.
// IT lệch khỏi blue chói (dấu hiệu "AI look"). Một hex chung cho light+dark.
export const CATEGORIES = [
  { key: "all", label: "Tất cả", color: ACCENT, icon: Grid },
  { key: "it", label: "IT", color: "#4c6ea3", icon: Code },
  { key: "ai", label: "AI", color: "#6a5aa0", icon: Sparkles },
  { key: "finance", label: "Tài chính", color: "#2f7d6a", icon: CircleDollarSign },
  { key: "stock", label: "Chứng khoán", color: "#b56033", icon: BarChart3 },
  { key: "arch", label: "Kiến trúc", color: "#5f6b7a", icon: Compass },
  { key: "culture", label: "Văn hóa", color: "#b8874a", icon: Landmark },
  { key: "ent", label: "Giải trí", color: "#b25877", icon: PlayCircle },
  { key: "news", label: "Tin tức", color: "#3f8770", icon: Newspaper },
  { key: "growth", label: "Phát triển bản thân", color: "#5a8a55", icon: TrendingUp },
  { key: "book", label: "Review sách", color: "#a5623f", icon: BookOpen },
] as const satisfies readonly Category[];

export const CATEGORY_BY_KEY = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, Category>;

// Map tag (theo slug rồi tới name, không phân biệt hoa thường) → CategoryKey.
// Không khớp → "news" (mặc định trung tính, xác định).
const LOOKUP: Record<string, CategoryKey> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.label.toLowerCase()] = c.key;
    acc[c.key] = c.key;
    return acc;
  },
  {} as Record<string, CategoryKey>,
);

// Màu cho chip 1 tag: khớp category → màu category; không khớp → accent
// (khác categoryFromTags vốn fallback "news" cho ngữ cảnh phân loại bài).
export function categoryColorForTag(tag: { name: string; slug: string }): string {
  const hit = LOOKUP[tag.slug?.toLowerCase()] ?? LOOKUP[tag.name?.toLowerCase()];
  if (hit && hit !== "all") return CATEGORY_BY_KEY[hit].color;
  return ACCENT;
}

export function categoryFromTags(
  tags: ReadonlyArray<{ name: string; slug: string }>,
): CategoryKey {
  for (const t of tags) {
    const hit = LOOKUP[t.slug?.toLowerCase()] ?? LOOKUP[t.name?.toLowerCase()];
    if (hit && hit !== "all") return hit;
  }
  return "news";
}
