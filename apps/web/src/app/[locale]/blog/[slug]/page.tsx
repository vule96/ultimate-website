import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublishedBySlug, listAllPublished } from "@/features/posts/api";
import { buildPostMetadata } from "@/features/posts/metadata";
import { CoverImage } from "@/features/posts/components/cover-image";
import { PostContent } from "@/features/posts/components/post-content";
import { ViewTracker } from "@/features/posts/components/view-tracker";
import { TagBadge } from "@/features/posts/components/tag-badge";
import { RelatedPosts } from "@/features/posts/components/related-posts";
import { ReadingProgress } from "@/features/posts/components/reading-progress";
import { categoryFromTags, CATEGORY_BY_KEY } from "@/features/magazine/categories";
import { formatViews } from "@/features/magazine/lib/format";
import { formatDate, readingTime } from "@/lib/format";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const post = await getPublishedBySlug(params.slug);
  if (!post) return {};
  const meta = buildPostMetadata(post);
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      languages: {
        vi: `/blog/${post.slug}`,
        en: `/en/blog/${post.slug}`,
        "x-default": `/blog/${post.slug}`,
      },
    },
  };
}

export async function generateStaticParams() {
  try {
    const posts = await listAllPublished();
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    // Core API không sẵn sàng lúc build → prerender rỗng, dựa ISR on-demand (dynamicParams=true).
    return [];
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(params.locale);
  const post = await getPublishedBySlug(params.slug);
  if (!post) notFound();
  const t = await getTranslations("detail");

  const date = formatDate(post.published_at);
  const mins = readingTime(post.content_html);
  const primaryTag = post.tags[0];
  const cat = CATEGORY_BY_KEY[categoryFromTags(post.tags)];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    image: post.cover_image ?? undefined,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": "Person", name: SITE_NAME },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" để tránh breakout </script> (dù title là admin-controlled) — chuẩn inline JSON-LD.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ReadingProgress />
      <main className="mx-auto max-w-prose px-5 py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted no-underline transition-colors hover:text-fg"
        >
          <span aria-hidden>←</span> {t("back")}
        </Link>

        <article>
          <header className="mt-8">
            {primaryTag ? (
              <Link
                href={`/tags/${primaryTag.slug}`}
                className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] no-underline transition-opacity hover:opacity-75"
                style={{ color: cat.color }}
              >
                {primaryTag.name}
              </Link>
            ) : null}
            <h1 className="mt-3 font-display text-[2rem] font-black leading-[1.15] tracking-[-0.01em] text-fg [text-wrap:balance] sm:text-[2.6rem]">
              {post.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-muted">
              {date ? (
                <time dateTime={post.published_at ?? undefined}>{date}</time>
              ) : null}
              {date ? <span aria-hidden>·</span> : null}
              <span>{t("readMinutes", { minutes: mins })}</span>
              {post.views > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{t("views", { count: formatViews(post.views) })}</span>
                </>
              ) : null}
            </div>
          </header>

          <hr className="mt-8" />

          {post.cover_image ? (
            // CoverImage: khung aspect reserve chỗ trước khi ảnh về (CLS = 0),
            // blurhash placeholder hiện tức thì, ảnh thật fade-in.
            <CoverImage
              src={post.cover_image}
              alt={post.title}
              hash={post.cover_blurhash}
              priority
              sizes="(max-width: 42rem) 100vw, 42rem"
              className="mt-8 rounded-2xl border border-border shadow-[var(--shadow-card)]"
            />
          ) : null}

          <ViewTracker postId={post.id} />

          <div className="mt-8">
            <PostContent html={post.content_html} imageMeta={post.content_image_meta} />
          </div>
        </article>

        <footer className="mt-14 border-t border-line pt-8">
          {post.tags.length > 0 ? (
            <>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                {t("topics")}
              </p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <TagBadge key={t.slug} tag={t} />
                ))}
              </div>
            </>
          ) : null}
          <RelatedPosts post={post} />
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent no-underline transition-opacity hover:opacity-75"
            >
              <span aria-hidden>←</span> {t("viewAll")}
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
