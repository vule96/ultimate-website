"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Section } from "../sections";
import type { ArticleVM } from "../types";
import { NewsCard } from "./news-card";

/** Band một chuyên mục: header màu section + grid card. Ẩn khi rỗng. */
export function SectionBand({ section, articles }: { section: Section; articles: ArticleVM[] }) {
  const t = useTranslations("sections");
  if (articles.length === 0) return null;
  return (
    <section id={`sec-${section.key}`} className="mb-9 scroll-mt-24">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-[11px] w-[11px] flex-none rounded-sm" style={{ background: section.color }} />
        <h2 className="text-[19px] font-extrabold tracking-[-0.015em]" style={{ color: section.color }}>
          {t(section.key)}
        </h2>
        <span className="h-[2px] flex-1 opacity-20" style={{ background: section.color }} />
        <Link
          href="/tags"
          className="text-[12.5px] font-bold text-muted no-underline hover:text-fg"
        >
          {t("viewAll")} →
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.slice(0, 3).map((a) => (
          <NewsCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  );
}
