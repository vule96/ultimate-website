"use client";
import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CoverImage } from "@/features/posts/components/cover-image";
import { useMagazineStore } from "../store/magazine-store";
import { filterArticles } from "../lib/filter";
import { formatViews } from "../lib/format";
import type { ArticleVM } from "../types";

/**
 * Featured lead: 1 bài lead lớn + 2 bài phụ (Slice 16 — tạo hierarchy,
 * giết cảm giác "list phẳng 12 row đều nhau"). Lấy 3 bài đầu của danh sách
 * đã lọc (cùng store query/cat như ArticleList → nhất quán). ArticleList bỏ
 * 3 bài này qua skipCount để không trùng.
 */
export function FeaturedLead({ articles }: { articles: ArticleVM[] }) {
  const t = useTranslations("featured");
  const router = useRouter();
  const query = useMagazineStore((s) => s.query);
  const cat = useMagazineStore((s) => s.cat);
  const open = useCallback((slug: string) => router.push(`/blog/${slug}`), [router]);

  const top = useMemo(
    () => filterArticles(articles, query, cat).slice(0, 3),
    [articles, query, cat],
  );
  if (top.length === 0) return null;
  const [lead, ...secondary] = top;

  return (
    <section className="mx-auto max-w-shell px-5 pt-7 sm:px-[26px]">
      <div className="grid gap-x-9 gap-y-7 lg:grid-cols-[1.55fr_1fr]">
        {/* Lead */}
        <article
          onClick={() => open(lead.slug)}
          className="group cursor-pointer"
        >
          {lead.coverImage ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-line">
              <CoverImage
                src={lead.coverImage}
                alt=""
                hash={lead.blurhash}
                priority
                sizes="(max-width: 1024px) 100vw, 760px"
                className="transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          ) : (
            <TypographicCover
              label={lead.categoryLabel}
              color={lead.color}
              className="mb-4 aspect-[16/9] p-6"
              labelClass="text-[clamp(30px,5vw,56px)]"
            />
          )}
          <Kicker color={lead.color} label={lead.categoryLabel} eyebrow={t("eyebrow")} />
          <h2 className="mt-3 font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.02em] text-fg sm:text-[38px]">
            {lead.title}
          </h2>
          {lead.excerpt && (
            <p className="mt-3 line-clamp-2 max-w-[54ch] font-serif text-[16px] leading-relaxed text-muted">
              {lead.excerpt}
            </p>
          )}
          <Meta
            article={lead}
            viewsLabel={
              lead.views && lead.views > 0
                ? t("views", { count: formatViews(lead.views) })
                : null
            }
          />
        </article>

        {/* Secondary (2 bài) */}
        {secondary.length > 0 && (
          <div className="flex flex-col">
            {secondary.map((a, i) => (
              <article
                key={a.id}
                onClick={() => open(a.slug)}
                className={`group flex cursor-pointer gap-4 py-4 ${i > 0 ? "border-t border-line" : "lg:pt-0"}`}
              >
                {a.coverImage ? (
                  <div className="w-[104px] flex-none overflow-hidden rounded-lg border border-line">
                    <CoverImage
                      src={a.coverImage}
                      alt=""
                      hash={a.blurhash}
                      sizes="104px"
                      className="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <TypographicCover
                    label={a.categoryLabel}
                    color={a.color}
                    className="aspect-[16/9] w-[104px] flex-none p-2.5"
                    labelClass="text-[15px]"
                  />
                )}
                <div className="min-w-0">
                  <Kicker color={a.color} label={a.categoryLabel} />
                  <h3 className="mt-1.5 font-display text-[17px] font-bold leading-[1.22] tracking-[-0.01em] text-fg">
                    {a.title}
                  </h3>
                  <div className="mt-1.5 font-mono text-[11px] text-muted">{a.dateLabel}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="mt-7 border-b border-line" />
    </section>
  );
}

/** Bìa chữ khi bài không có ảnh cover — thay khối màu trơ bằng typography có chủ đích. */
function TypographicCover({
  label,
  color,
  className = "",
  labelClass,
}: {
  label: string;
  color: string;
  className?: string;
  labelClass: string;
}) {
  return (
    <div
      className={`flex flex-col justify-between overflow-hidden rounded-xl border ${className}`}
      style={{
        borderColor: `color-mix(in srgb, ${color} 40%, var(--line))`,
        background: `color-mix(in srgb, ${color} 12%, var(--surface))`,
      }}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] opacity-70" style={{ color }}>
        Mạch
      </span>
      <span
        className={`font-display font-extrabold uppercase leading-[0.9] tracking-[-0.02em] ${labelClass}`}
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

function Kicker({ color, label, eyebrow }: { color: string; label: string; eyebrow?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {eyebrow && (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </span>
      )}
      <span className="text-[12px] font-bold uppercase tracking-wide" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function Meta({ article, viewsLabel }: { article: ArticleVM; viewsLabel: string | null }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11.5px] text-muted">
      <span>{article.dateLabel}</span>
      <span aria-hidden>·</span>
      <span>{article.readTime}</span>
      {viewsLabel && (
        <>
          <span aria-hidden>·</span>
          <span>{viewsLabel}</span>
        </>
      )}
    </div>
  );
}
