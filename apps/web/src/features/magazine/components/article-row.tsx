import { memo } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import type { ArticleVM } from "../types";
import { formatViews } from "../lib/format";

interface Props {
  article: ArticleVM;
  index: number;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onOpen: (slug: string) => void;
}

function ArticleRowBase({ article, index, saved, onToggleSave, onOpen }: Props) {
  const tint = `color-mix(in srgb, ${article.color} var(--tint-strength), transparent)`;
  return (
    <article
      onClick={() => onOpen(article.slug)}
      className="flex cursor-pointer items-start gap-[18px] border-b border-line py-[19px] [content-visibility:auto]"
    >
      <div
        className="relative flex h-[90px] w-[132px] flex-none items-end overflow-hidden rounded-lg p-[9px]"
        style={{ backgroundColor: article.color }}
      >
        {article.coverImage && (
          <Image src={article.coverImage} alt="" fill sizes="132px" className="object-cover" />
        )}
        <span className="absolute -top-[10px] right-[5px] font-display text-[58px] font-extrabold leading-none text-white/20">
          {index + 1}
        </span>
        <span className="relative rounded bg-black/30 px-[7px] py-[3px] font-mono text-[8.5px] font-bold uppercase tracking-wide text-white">
          {article.categoryLabel}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-[7px] flex items-center gap-[10px]">
          <span
            className="rounded-[5px] px-[9px] py-[3px] text-[11px] font-bold"
            style={{ color: article.color, background: tint }}
          >
            {article.categoryLabel}
          </span>
          <span className="font-mono text-[11px] text-muted">{article.dateLabel}</span>
        </div>
        <h3 className="mb-[6px] font-display text-[20px] font-bold leading-[1.22] tracking-[-0.01em] text-fg">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mb-2 truncate text-[13px] leading-[1.5] text-muted">{article.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-[11.5px] text-muted">
          {article.author && <span className="font-bold text-fg">{article.author}</span>}
          {article.comments !== null && (
            <>
              <span>·</span>
              <span>{article.comments} bình luận</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-col items-end gap-[11px]">
        <button
          type="button"
          aria-label={saved ? "Bỏ lưu" : "Lưu bài viết"}
          aria-pressed={saved}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(article.id);
          }}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
          style={saved ? { color: article.color, background: tint, borderColor: article.color } : undefined}
        >
          <Star size={15} fill={saved ? "currentColor" : "none"} strokeWidth={2} />
        </button>
        <div className="text-right font-mono text-[10.5px] leading-[1.7] text-muted">
          {article.views !== null && (
            <>
              {formatViews(article.views)}
              <br />
            </>
          )}
          {article.readTime}
        </div>
      </div>
    </article>
  );
}

export const ArticleRow = memo(ArticleRowBase);
