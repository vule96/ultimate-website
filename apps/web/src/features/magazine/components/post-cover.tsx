import { CoverImage } from "@/features/posts/components/cover-image";
import type { ArticleVM } from "../types";

/**
 * Cover bài: ảnh thật (blurhash, CLS 0) hoặc bìa chữ khi không có ảnh —
 * panel tint màu section + nhãn chuyên mục lớn. `color` là CSS var theme-aware.
 */
export function PostCover({
  article,
  color,
  aspect = "aspect-[16/10]",
  sizes = "(max-width: 768px) 100vw, 400px",
  priority = false,
}: {
  article: ArticleVM;
  color: string;
  aspect?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (article.coverImage) {
    return (
      <CoverImage
        src={article.coverImage}
        alt=""
        hash={article.blurhash}
        aspectClass={aspect}
        sizes={sizes}
        priority={priority}
      />
    );
  }
  return (
    <div
      className={`relative flex items-end overflow-hidden p-3.5 ${aspect}`}
      style={{ background: `color-mix(in srgb, ${color} 14%, var(--surface))` }}
    >
      <span
        className="absolute left-3.5 top-3 text-[9px] font-extrabold uppercase tracking-[0.2em] opacity-70"
        style={{ color }}
      >
        Mạch
      </span>
      <span
        className="font-display text-[clamp(20px,5vw,40px)] font-black uppercase leading-[0.9] tracking-[-0.02em]"
        style={{ color }}
      >
        {article.categoryLabel}
      </span>
    </div>
  );
}
