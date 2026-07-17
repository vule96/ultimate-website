import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listPublished } from "@/features/posts/api";
import { PostList } from "@/features/posts/components/post-list";
import { Pagination } from "@/features/posts/components/pagination";
import { totalPages } from "@/features/posts/pagination-utils";
import { categoryColorForTag } from "@/features/magazine/categories";
import { PAGE_SIZE } from "@/lib/config";

type Props = { page: number; tag?: string; basePath: string };

// PostsPage render danh sách bài PUBLISHED có phân trang. Dùng chung cho trang chủ
// và trang tag; soft-404 khi page vượt tổng số trang (total > 0).
export async function PostsPage({ page, tag, basePath }: Props) {
  const t = await getTranslations("tagsPage");
  const { data, total } = await listPublished(tag ? { page, tag } : { page });
  const pages = totalPages(total, PAGE_SIZE);
  if (page > pages && total > 0) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <header className={tag ? "mb-8" : "mb-12"}>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {tag ? t("kicker") : "Blog"}
        </p>
        <h1
          className="mt-3 font-display text-[2.4rem] font-black leading-[1.12] tracking-[-0.01em] text-fg sm:text-[2.9rem]"
          style={tag ? { color: categoryColorForTag({ name: tag, slug: tag }) } : undefined}
        >
          {tag ? `#${tag}` : "Bài viết"}
        </h1>
        {tag ? (
          <p className="mt-3 font-mono text-[12px] text-muted">{t("count", { count: total })}</p>
        ) : (
          <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted">
            Ghi chép về backend, kiến trúc và những thứ đang học — bằng Go, Next.js và hơn thế nữa.
          </p>
        )}
      </header>
      <PostList posts={data} />
      <Pagination page={page} totalPages={pages} basePath={basePath} />
    </main>
  );
}
