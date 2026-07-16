import { memo } from "react";
import Image from "next/image";
import { m } from "framer-motion";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { BlurhashCanvas } from "@/features/posts/components/blurhash-canvas";
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
  const t = useTranslations("list");
  const tint = `color-mix(in srgb, ${article.color} var(--tint-strength), transparent)`;
  return (
    <m.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.3, ease: "easeOut", delay: Math.min(index, 5) * 0.05 }}
      onClick={() => onOpen(article.slug)}
      className="flex cursor-pointer items-start gap-[18px] border-b border-line py-[19px] [contain-intrinsic-size:auto_129px] [content-visibility:auto]"
    >
      <div
        className="relative hidden h-[90px] w-[132px] flex-none items-end overflow-hidden rounded-lg p-[9px] sm:flex"
        style={{ backgroundColor: article.color }}
      >
        {article.coverImage && (
          <>
            <BlurhashCanvas hash={article.blurhash} />
            <Image
              src={article.coverImage}
              alt=""
              fill
              sizes="132px"
              quality={75}
              priority={index < 2}
              className="object-cover"
            />
          </>
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
        <h3 className="mb-[6px] font-display text-[17px] font-bold leading-[1.25] tracking-[-0.01em] text-fg sm:text-[20px] sm:leading-[1.22]">
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
              <span>{t("comments", { count: article.comments })}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-col items-end gap-[11px]">
        <button
          type="button"
          aria-label={saved ? t("unsaveAria") : t("saveAria")}
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
        <div className="hidden text-right font-mono text-[10.5px] leading-[1.7] text-muted sm:block">
          {article.views !== null && (
            <>
              {formatViews(article.views)}
              <br />
            </>
          )}
          {article.readTime}
        </div>
      </div>
    </m.article>
  );
}

export const ArticleRow = memo(ArticleRowBase);
