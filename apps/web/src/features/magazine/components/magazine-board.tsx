"use client";
import { useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { LazyMotion, MotionConfig } from "framer-motion";

// Nạp animation features async — giữ bundle đầu nhẹ (LazyMotion chỉ cần m. lúc hydrate).
const loadMotionFeatures = () => import("framer-motion").then((mod) => mod.domAnimation);
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
  const openArticle = useCallback((slug: string) => router.push(`/blog/${slug}`), [router]);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
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
            <TopViewedList items={topViewed} onOpen={openArticle} />
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
      </LazyMotion>
    </MotionConfig>
  );
}
