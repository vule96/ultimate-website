import Link from "next/link";
import type { Post } from "@ultimate/types";
import { formatDate, readingTime } from "@/lib/format";

/** Một mục bài viết trong danh sách — kiểu tạp chí, chữ dẫn đầu. */
export function PostCard({ post }: { post: Post }) {
  const date = formatDate(post.published_at);
  const mins = readingTime(post.content_html);
  const primaryTag = post.tags[0];

  return (
    <article className="group py-8 first:pt-0">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {primaryTag ? (
            <span className="font-semibold uppercase tracking-wider text-primary">
              {primaryTag.name}
            </span>
          ) : null}
          {primaryTag && date ? <span aria-hidden className="text-border">•</span> : null}
          {date ? <time className="text-muted-foreground">{date}</time> : null}
          <span aria-hidden className="text-border">•</span>
          <span className="text-muted-foreground">{mins} phút đọc</span>
        </div>

        <h2 className="mt-2.5 font-serif text-[1.7rem] font-semibold leading-[1.2] tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
          {post.title}
        </h2>

        {post.excerpt ? (
          <p className="mt-2.5 max-w-[46rem] leading-relaxed text-muted-foreground">
            {post.excerpt}
          </p>
        ) : null}

        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Đọc bài <span aria-hidden>→</span>
        </span>
      </Link>
    </article>
  );
}
