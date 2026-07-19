"use client";
import { Link } from "@/i18n/navigation";
import { sectionColorForCategory } from "../sections";
import { formatViews } from "../lib/format";
import type { ArticleVM } from "../types";
import { CoverImage } from "@/features/posts/components/cover-image";
import { PostCover } from "./post-cover";
import { SaveButton } from "./save-button";

/** Hero newsroom: 1 lead (title đè ảnh) + tối đa 4 mini. */
export function Hero({ lead, secondary }: { lead: ArticleVM; secondary: ArticleVM[] }) {
  const color = sectionColorForCategory(lead.category);
  const hasImg = Boolean(lead.coverImage);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.85fr_1fr]">
      {/* Lead */}
      <Link
        href={`/blog/${lead.slug}`}
        className="group relative block aspect-[16/10] overflow-hidden rounded-xl border border-line no-underline"
      >
        {hasImg ? (
          <>
            <CoverImage
              src={lead.coverImage as string}
              alt=""
              hash={lead.blurhash}
              aspectClass="absolute inset-0 h-full w-full"
              sizes="(max-width: 1024px) 100vw, 760px"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: `color-mix(in srgb, ${color} 18%, var(--surface))` }}
          />
        )}
        <SaveButton id={lead.id} className="absolute right-3 top-3" />
        <div className={`absolute inset-x-0 bottom-0 p-5 sm:p-6 ${hasImg ? "text-white" : "text-fg"}`}>
          <span
            className="mb-3 inline-block rounded px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.05em]"
            style={
              hasImg
                ? { background: "var(--brand)", color: "#fff" }
                : { background: `color-mix(in srgb, ${color} 22%, transparent)`, color }
            }
          >
            {lead.categoryLabel}
          </span>
          <h2 className="max-w-[20ch] font-display text-[26px] font-black leading-[1.08] tracking-[-0.022em] sm:text-[33px]">
            {lead.title}
          </h2>
          {lead.excerpt && (
            <p
              className={`mt-2.5 hidden max-w-[52ch] text-[15px] leading-relaxed sm:block ${hasImg ? "text-white/80" : "text-muted"}`}
            >
              {lead.excerpt}
            </p>
          )}
          <div
            className={`mt-3 flex items-center gap-2 text-[12.5px] tabular-nums ${hasImg ? "text-white/70" : "text-faint"}`}
          >
            <span>{lead.dateLabel}</span>
            <span aria-hidden>·</span>
            <span>{lead.readTime}</span>
            {lead.views !== null && lead.views > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{formatViews(lead.views)}</span>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* Mini */}
      <div className="flex flex-col">
        {secondary.map((a, i) => {
          const c = sectionColorForCategory(a.category);
          return (
            <Link
              key={a.id}
              href={`/blog/${a.slug}`}
              className={`group grid grid-cols-[82px_1fr] items-start gap-3.5 py-3.5 no-underline ${i > 0 ? "border-t border-line" : "pt-0"}`}
              style={{ ["--sc" as string]: c }}
            >
              <div className="overflow-hidden rounded-lg border border-line">
                <PostCover article={a} color={c} aspect="aspect-square" sizes="82px" />
              </div>
              <div className="min-w-0">
                <div
                  className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.04em]"
                  style={{ color: c }}
                >
                  {a.categoryLabel}
                </div>
                <h3 className="text-[14.5px] font-bold leading-[1.26] tracking-[-0.01em] text-fg transition-colors group-hover:text-[color:var(--sc)]">
                  {a.title}
                </h3>
                <div className="mt-1.5 text-[11px] tabular-nums text-faint">
                  {a.dateLabel} · {a.readTime}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
