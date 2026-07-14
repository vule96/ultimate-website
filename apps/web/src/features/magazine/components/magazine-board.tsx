"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "../categories";
import { useMagazineStore } from "../store/magazine-store";
import { Masthead } from "./masthead";
import { SubNav } from "./sub-nav";
import { CategoryRail } from "./category-rail";
import { ArticleList } from "./article-list";
import { TrendingChips } from "./trending-chips";
import { TopViewedList } from "./top-viewed-list";
import { Toast } from "./toast";
import type { ArticleVM } from "../types";

const AuthModal = dynamic(() => import("./auth-modal").then((m) => m.AuthModal), { ssr: false });

const TRENDING = CATEGORIES.filter((c) =>
  ["ai", "it", "finance", "growth", "culture"].includes(c.key),
);

export function MagazineBoard({
  articles,
  topViewed,
}: {
  articles: ArticleVM[];
  topViewed: ArticleVM[];
}) {
  const router = useRouter();
  const authOpen = useMagazineStore((s) => s.authOpen);
  const setCat = useMagazineStore((s) => s.setCat);

  return (
    <>
      <Masthead />
      <SubNav />
      <div className="mx-auto flex max-w-shell">
        <CategoryRail />
        <ArticleList articles={articles} />
        <aside className="w-[250px] flex-none border-l border-line bg-surface px-[22px] py-6">
          <div className="mb-[14px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Thịnh hành
          </div>
          <TrendingChips categories={TRENDING} onSelect={setCat} />
          <div className="mb-[14px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Top xem nhiều
          </div>
          <TopViewedList items={topViewed} onOpen={(slug) => router.push(`/blog/${slug}`)} />
          <a
            href="/"
            className="mt-[26px] block rounded-[9px] bg-accent py-3 text-center text-[13px] font-bold text-white no-underline"
          >
            Tham gia nhóm Facebook →
          </a>
        </aside>
      </div>
      <Toast />
      {authOpen && <AuthModal />}
    </>
  );
}
