"use client";
import { useCallback, useDeferredValue, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMagazineStore } from "../store/magazine-store";
import { filterArticles } from "../lib/filter";
import { ArticleRow } from "./article-row";
import type { ArticleVM } from "../types";

export function ArticleList({
  articles,
  skipCount = 0,
}: {
  articles: ArticleVM[];
  /** Số bài đầu (đã lọc) do FeaturedLead hiển thị — bỏ để không trùng. */
  skipCount?: number;
}) {
  const t = useTranslations("list");
  const router = useRouter();
  const query = useMagazineStore((s) => s.query);
  const cat = useMagazineStore((s) => s.cat);
  const saved = useMagazineStore((s) => s.saved);
  const toggleSave = useMagazineStore((s) => s.toggleSave);

  const openArticle = useCallback((slug: string) => router.push(`/blog/${slug}`), [router]);
  const deferredQuery = useDeferredValue(query);
  const isStale = deferredQuery !== query;
  const filtered = useMemo(
    () => filterArticles(articles, deferredQuery, cat),
    [articles, deferredQuery, cat],
  );
  // FeaturedLead lấy `skipCount` bài đầu (cùng bộ lọc) → list bỏ để không lặp.
  const visible = useMemo(() => filtered.slice(skipCount), [filtered, skipCount]);

  return (
    <main className="min-w-0 flex-1 px-5 py-6 sm:px-[26px]">
      <div className="mb-[18px] flex items-baseline justify-between">
        <h2 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">
          {t("latest")}
        </h2>
        <span className="font-mono text-[11px] text-muted">
          {t("results", { count: filtered.length })}
        </span>
      </div>
      <div className={`flex flex-col transition-opacity ${isStale ? "opacity-60" : ""}`}>
        {visible.map((a, i) => (
          <ArticleRow
            key={a.id}
            article={a}
            index={i}
            saved={Boolean(saved[a.id])}
            onToggleSave={toggleSave}
            onOpen={openArticle}
          />
        ))}
        {filtered.length === 0 && (
          <p className="py-16 text-center text-muted">{t("empty")}</p>
        )}
      </div>
    </main>
  );
}
