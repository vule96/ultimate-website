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

const ACCENT = "#e1442b"; // brand cam-đỏ (vermilion)

// Newsroom (bản C): màu category theo hệ section (color-code chuyên mục).
// Cùng section → cùng hue. Đỏ dành riêng cho brand, không dùng cho category.
export const CATEGORIES = [
  { key: "all", label: "Tất cả", color: ACCENT, icon: Grid },
  { key: "it", label: "IT", color: "#2565b0", icon: Code },
  { key: "ai", label: "AI", color: "#2565b0", icon: Sparkles },
  { key: "finance", label: "Tài chính", color: "#1f7a52", icon: CircleDollarSign },
  { key: "stock", label: "Chứng khoán", color: "#1f7a52", icon: BarChart3 },
  { key: "arch", label: "Kiến trúc", color: "#b06a1f", icon: Compass },
  { key: "culture", label: "Văn hóa", color: "#a0452f", icon: Landmark },
  { key: "ent", label: "Giải trí", color: "#a0452f", icon: PlayCircle },
  { key: "news", label: "Tin tức", color: "#64707d", icon: Newspaper },
  { key: "growth", label: "Phát triển bản thân", color: "#6a4aa0", icon: TrendingUp },
  { key: "book", label: "Review sách", color: "#8a6a34", icon: BookOpen },
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
