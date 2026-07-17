import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Post } from "@ultimate/types";
import { formatDate, readingTime } from "@/lib/format";
import { categoryColorForTag } from "@/features/magazine/categories";
import { BlurhashCanvas } from "@/features/posts/components/blurhash-canvas";

/** Row bài viết kiểu Mạch: thumbnail blurhash + kicker màu category + meta mono. */
export function PostCard({ post }: { post: Post }) {
  const date = formatDate(post.published_at);
  const mins = readingTime(post.content_html);
  const primaryTag = post.tags[0];
  const color = primaryTag ? categoryColorForTag(primaryTag) : "var(--accent)";

  return (
    <article className="group border-b border-line py-6 last:border-0">
      <Link href={`/blog/${post.slug}`} className="flex gap-[18px] no-underline">
        {post.cover_image ? (
          <div
            data-thumb
            className="relative hidden h-[90px] w-[132px] flex-none overflow-hidden rounded-lg sm:block"
            style={{ backgroundColor: color }}
          >
            <BlurhashCanvas hash={post.cover_blurhash} />
            <Image
              src={post.cover_image}
              alt=""
              fill
              sizes="132px"
              quality={75}
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="mb-[6px] flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10.5px] text-muted">
            {primaryTag ? (
              <span className="font-bold uppercase tracking-wide" style={{ color }}>
                {primaryTag.name}
              </span>
            ) : null}
            {primaryTag && date ? <span aria-hidden>·</span> : null}
            {date ? <time>{date}</time> : null}
            <span aria-hidden>·</span>
            <span>{mins} phút đọc</span>
          </div>

          <h2 className="font-display text-[20px] font-bold leading-[1.25] tracking-[-0.01em] text-fg transition-colors group-hover:text-accent">
            {post.title}
          </h2>

          {post.excerpt ? (
            <p className="mt-1.5 text-[14px] leading-[1.6] text-muted line-clamp-2">
              {post.excerpt}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
