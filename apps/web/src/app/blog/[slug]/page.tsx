import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedBySlug, listAllPublished } from "@/features/posts/api";
import { buildPostMetadata } from "@/features/posts/metadata";
import { PostContent } from "@/features/posts/components/post-content";
import { TagBadge } from "@/features/posts/components/tag-badge";
import { ReadingProgress } from "@/features/posts/components/reading-progress";
import { formatDate, readingTime } from "@/lib/format";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPublishedBySlug(params.slug);
  if (!post) return {};
  return buildPostMetadata(post);
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
  params: { slug: string };
}) {
  const post = await getPublishedBySlug(params.slug);
  if (!post) notFound();

  const date = formatDate(post.published_at);
  const mins = readingTime(post.content_html);
  const primaryTag = post.tags[0];

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
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span> Bài viết
        </Link>

        <article>
          <header className="mt-8">
            {primaryTag ? (
              <Link href={`/tags/${primaryTag.slug}`} className="article-kicker transition-opacity hover:opacity-75">
                {primaryTag.name}
              </Link>
            ) : null}
            <h1 className="article-title mt-3 text-[2.1rem] sm:text-[2.55rem]">{post.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
              {date ? (
                <time dateTime={post.published_at ?? undefined}>{date}</time>
              ) : null}
              {date ? <span aria-hidden className="text-border">•</span> : null}
              <span>{mins} phút đọc</span>
            </div>
          </header>

          <hr className="mt-8" />

          {post.cover_image ? (
            <Image
              src={post.cover_image}
              alt={post.title}
              width={1200}
              height={630}
              priority
              sizes="(max-width: 42rem) 100vw, 42rem"
              className="mt-8 w-full rounded-2xl border border-border object-cover shadow-[var(--shadow-card)]"
            />
          ) : null}

          <div className="mt-8">
            <PostContent html={post.content_html} />
          </div>
        </article>

        <footer className="mt-14 border-t pt-8">
          {post.tags.length > 0 ? (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Chủ đề
              </p>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <TagBadge key={t.slug} tag={t} />
                ))}
              </div>
            </>
          ) : null}
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-opacity hover:opacity-75"
            >
              <span aria-hidden>←</span> Xem tất cả bài viết
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
