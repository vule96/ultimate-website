"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CATEGORIES } from "../categories";
import { sectionColorForCategory } from "../sections";
import type { ArticleVM } from "../types";
import { NewsletterBox } from "./newsletter-box";

const TOPIC_CHIPS = CATEGORIES.filter((c) => c.key !== "all" && c.key !== "news");

/** Rail phải newsroom: Đọc nhiều nhất + Chủ đề + Bản tin. */
export function NewsroomRail({ topViewed }: { topViewed: ArticleVM[] }) {
  const t = useTranslations("sidebar");
  const tn = useTranslations("newsletter");
  return (
    <aside className="hidden w-[300px] flex-none lg:block">
      <div className="flex flex-col gap-7">
        <div>
          <h4 className="mb-1 inline-block border-b-2 border-brand pb-2.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-fg">
            {t("topViewed")}
          </h4>
          <div className="mt-1">
            {topViewed.slice(0, 5).map((a, i) => (
              <Link
                key={a.id}
                href={`/blog/${a.slug}`}
                className="group grid grid-cols-[24px_1fr] items-baseline gap-3 border-b border-line py-3 no-underline last:border-b-0"
              >
                <span className="text-[15px] font-extrabold tabular-nums text-brand">{i + 1}</span>
                <span>
                  <span className="block text-[14px] font-bold leading-[1.3] tracking-[-0.01em] text-fg group-hover:text-brand">
                    {a.title}
                  </span>
                  {a.views !== null && a.views > 0 && (
                    <span className="mt-1 block text-[11.5px] tabular-nums text-faint">
                      {a.views.toLocaleString("vi-VN")} lượt xem
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 inline-block border-b-2 border-brand pb-2.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-fg">
            {t("trending")}
          </h4>
          <div className="flex flex-wrap gap-2">
            {TOPIC_CHIPS.map((c) => (
              <Link
                key={c.key}
                href="/tags"
                className="rounded-md bg-surface-2 px-3 py-1.5 text-[12.5px] font-bold text-muted no-underline transition-colors hover:text-fg"
                style={{ ["--sc" as string]: sectionColorForCategory(c.key) }}
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-ink p-5 text-ink-fg">
          <h4 className="mb-1 inline-block border-b-2 border-brand pb-2.5 text-[12px] font-extrabold uppercase tracking-[0.1em]">
            {tn("title")}
          </h4>
          <p className="mb-3 mt-2 text-[13px] text-ink-muted">{tn("benefit")}</p>
          <NewsletterBox variant="footer" />
        </div>
      </div>
    </aside>
  );
}
