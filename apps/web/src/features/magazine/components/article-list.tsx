"use client";
import { useCallback, useDeferredValue, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMagazineStore } from "../store/magazine-store";
import { filterArticles } from "../lib/filter";
import { ArticleRow } from "./article-row";
import type { ArticleVM } from "../types";

export function ArticleList({ articles }: { articles: ArticleVM[] }) {
  const router = useRouter();
  const query = useMagazineStore((s) => s.query);
  const cat = useMagazineStore((s) => s.cat);
  const saved = useMagazineStore((s) => s.saved);
  const toggleSave = useMagazineStore((s) => s.toggleSave);

  const openArticle = useCallback((slug: string) => router.push(`/blog/${slug}`), [router]);
  const deferredQuery = useDeferredValue(query);
  const isStale = deferredQuery !== query;
  const visible = useMemo(
    () => filterArticles(articles, deferredQuery, cat),
    [articles, deferredQuery, cat],
  );

  return (
    <main className="min-w-0 flex-1 px-[26px] py-6">
      <div className="mb-[18px] flex items-baseline justify-between">
        <h2 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">
          <span className="bg-[linear-gradient(transparent_58%,var(--highlight)_58%)] px-[2px]">
            Mới nhất
          </span>
        </h2>
        <span className="font-mono text-[11px] text-muted">{visible.length} kết quả</span>
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
        {visible.length === 0 && (
          <p className="py-16 text-center text-muted">Không tìm thấy bài viết phù hợp.</p>
        )}
      </div>
    </main>
  );
}
