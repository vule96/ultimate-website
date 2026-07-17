import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPublished } from "@/features/posts/api";
import { pickRelated } from "@/features/posts/related";
import { CoverImage } from "@/features/posts/components/cover-image";
import { categoryFromTags, CATEGORY_BY_KEY } from "@/features/magazine/categories";
import { formatDate } from "@/features/magazine/lib/format";
import type { Post } from "@ultimate/types";

/** Section "Bài liên quan" — 3 bài cùng tag đầu (fallback bài mới nhất), RSC + ISR. */
export async function RelatedPosts({ post }: { post: Post }) {
  const t = await getTranslations("detail");
  const tag = post.tags[0]?.slug;
  const { data } = await listPublished(tag ? { tag } : {}).catch(() => ({ data: [] as Post[] }));
  const related = pickRelated(data, post.slug);
  if (related.length === 0) return null;

  return (
    <section className="mt-14 border-t border-line pt-8">
      <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        {t("related")}
      </h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {related.map((p) => {
          const cat = CATEGORY_BY_KEY[categoryFromTags(p.tags)];
          return (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group block no-underline">
              {p.cover_image ? (
                <CoverImage
                  src={p.cover_image}
                  alt=""
                  hash={p.cover_blurhash}
                  sizes="(max-width: 640px) 100vw, 220px"
                  className="mb-3 rounded-lg"
                />
              ) : (
                <div
                  aria-hidden
                  className="mb-3 aspect-[16/9] rounded-lg opacity-80"
                  style={{ backgroundColor: cat.color }}
                />
              )}
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-wide"
                style={{ color: cat.color }}
              >
                {p.tags[0]?.name ?? cat.label}
              </span>
              <h3 className="mt-1 font-display text-[16px] font-bold leading-[1.3] text-fg group-hover:text-accent">
                {p.title}
              </h3>
              {p.published_at ? (
                <span className="mt-1 block font-mono text-[10.5px] text-muted">
                  {formatDate(p.published_at)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
