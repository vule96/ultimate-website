import type { ArticleVM, CategoryKey } from "../types";

export function filterArticles(
  items: ArticleVM[],
  query: string,
  cat: CategoryKey,
): ArticleVM[] {
  const q = query.trim().toLowerCase();
  return items.filter((a) => {
    if (cat !== "all" && a.category !== cat) return false;
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.categoryLabel.toLowerCase().includes(q) ||
      (a.author?.toLowerCase().includes(q) ?? false)
    );
  });
}
