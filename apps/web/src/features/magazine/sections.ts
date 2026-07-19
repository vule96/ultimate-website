import type { CategoryKey, ArticleVM } from "./types";

/** Section trang chủ newsroom — nhóm nhiều category thành 1 chuyên mục. */
export type SectionKey = "tech" | "finance" | "life" | "dev";

export interface Section {
  key: SectionKey;
  cats: readonly CategoryKey[];
  color: string; // CSS var — theme-aware
}

export const SECTIONS: readonly Section[] = [
  { key: "tech", cats: ["it", "ai"], color: "var(--sec-tech)" },
  { key: "finance", cats: ["finance", "stock"], color: "var(--sec-fin)" },
  { key: "life", cats: ["culture", "arch", "ent"], color: "var(--sec-life)" },
  { key: "dev", cats: ["growth", "book"], color: "var(--sec-dev)" },
] as const;

const CAT_TO_SECTION: Partial<Record<CategoryKey, SectionKey>> = Object.fromEntries(
  SECTIONS.flatMap((s) => s.cats.map((c) => [c, s.key])),
);

/** Section chứa category (news/unknown → undefined; news chỉ lên ticker). */
export function sectionOfCategory(cat: CategoryKey): SectionKey | undefined {
  return CAT_TO_SECTION[cat];
}

export const SECTION_BY_KEY: Record<SectionKey, Section> = Object.fromEntries(
  SECTIONS.map((s) => [s.key, s]),
) as Record<SectionKey, Section>;

/** Màu (CSS var, theme-aware) cho category theo section; news/unknown → muted. */
export function sectionColorForCategory(cat: CategoryKey): string {
  const sec = sectionOfCategory(cat);
  return sec ? SECTION_BY_KEY[sec].color : "var(--muted)";
}

/**
 * Gom bài theo section, giữ thứ tự bài đầu vào. Bài không thuộc section nào
 * (news) bị bỏ qua ở band (vẫn hiện ở ticker/hero). Thuần → test được.
 */
export function groupBySection(articles: ArticleVM[]): Record<SectionKey, ArticleVM[]> {
  const out: Record<SectionKey, ArticleVM[]> = { tech: [], finance: [], life: [], dev: [] };
  for (const a of articles) {
    const sec = sectionOfCategory(a.category);
    if (sec) out[sec].push(a);
  }
  return out;
}
