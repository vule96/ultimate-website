"use client";
import { useDeferredValue, useMemo } from "react";
import dynamic from "next/dynamic";
import { LazyMotion, MotionConfig } from "framer-motion";
import { useTranslations } from "next-intl";
import { useMagazineStore } from "../store/magazine-store";
import { filterArticles } from "../lib/filter";
import { groupBySection, SECTIONS } from "../sections";
import { Hero } from "./hero";
import { SectionBand } from "./section-band";
import { NewsroomRail } from "./newsroom-rail";
import { NewsCard } from "./news-card";
import { Toast } from "./toast";
import type { ArticleVM } from "../types";

const loadMotionFeatures = () => import("framer-motion").then((m) => m.domAnimation);
const AuthModal = dynamic(() => import("./auth-modal").then((m) => m.AuthModal), { ssr: false });

export function NewsroomBoard({
  articles,
  topViewed,
}: {
  articles: ArticleVM[];
  topViewed: ArticleVM[];
}) {
  const t = useTranslations("list");
  const authOpen = useMagazineStore((s) => s.authOpen);
  const query = useMagazineStore((s) => s.query);
  const deferredQuery = useDeferredValue(query);
  const isStale = deferredQuery !== query;
  const searching = deferredQuery.trim().length > 0;

  const visible = useMemo(
    () => filterArticles(articles, deferredQuery, "all"),
    [articles, deferredQuery],
  );

  const hero = visible.slice(0, 5);
  const lead = hero[0];
  const secondary = hero.slice(1, 5);
  const grouped = useMemo(() => {
    const heroIds = new Set(hero.map((a) => a.id));
    return groupBySection(visible.filter((a) => !heroIds.has(a.id)));
  }, [visible, hero]);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
        <main className="mx-auto max-w-shell px-5 py-7 sm:px-[30px]">
          {searching ? (
            <section className={isStale ? "opacity-60 transition-opacity" : ""}>
              <h1 className="mb-5 text-[15px] font-bold tabular-nums text-muted">
                {t("results", { count: visible.length })}
              </h1>
              {visible.length === 0 ? (
                <p className="py-16 text-center text-muted">{t("empty")}</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((a) => (
                    <NewsCard key={a.id} article={a} />
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {lead && <Hero lead={lead} secondary={secondary} />}
              <div className="mt-9 grid gap-10 lg:grid-cols-[1fr_300px]">
                <div>
                  {SECTIONS.map((s) => (
                    <SectionBand key={s.key} section={s} articles={grouped[s.key]} />
                  ))}
                </div>
                <NewsroomRail topViewed={topViewed} />
              </div>
            </>
          )}
        </main>
        <Toast />
        {authOpen && <AuthModal />}
      </LazyMotion>
    </MotionConfig>
  );
}
