"use client";
import { memo } from "react";
import { Link } from "@/i18n/navigation";
import { sectionColorForCategory } from "../sections";
import { formatViews } from "../lib/format";
import type { ArticleVM } from "../types";
import { PostCover } from "./post-cover";
import { SaveButton } from "./save-button";

/** Card bài trong band chuyên mục — cover + kicker màu section + title + deck + meta. */
export const NewsCard = memo(function NewsCard({
  article,
  priority = false,
}: {
  article: ArticleVM;
  priority?: boolean;
}) {
  const color = sectionColorForCategory(article.category);
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block no-underline"
      style={{ ["--sc" as string]: color }}
    >
      <div className="relative mb-3 overflow-hidden rounded-[10px] border border-line">
        <PostCover article={article} color={color} priority={priority} />
        <SaveButton id={article.id} className="absolute right-2.5 top-2.5" />
      </div>
      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em]" style={{ color }}>
        {article.categoryLabel}
      </div>
      <h3 className="mb-2 text-[16.5px] font-bold leading-[1.24] tracking-[-0.01em] text-fg transition-colors group-hover:text-[color:var(--sc)]">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="mb-2 line-clamp-2 text-[13px] leading-snug text-muted">{article.excerpt}</p>
      )}
      <div className="flex items-center gap-2 text-[11.5px] tabular-nums text-faint">
        <span>{article.dateLabel}</span>
        <span aria-hidden>·</span>
        <span>{article.readTime}</span>
        {article.views !== null && article.views > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{formatViews(article.views)}</span>
          </>
        )}
      </div>
    </Link>
  );
});
