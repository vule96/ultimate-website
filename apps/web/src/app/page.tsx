import { listPublished } from "@/features/posts/api";
import { PostList } from "@/features/posts/components/post-list";
import { Pagination } from "@/features/posts/components/pagination";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { data, total } = await listPublished({ page });
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <header className="mb-12">
        <p className="article-kicker">Blog</p>
        <h1 className="article-title mt-3 text-[2.4rem] sm:text-[2.9rem]">Bài viết</h1>
        <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted-foreground">
          Ghi chép về backend, kiến trúc và những thứ đang học — bằng Go, Next.js và hơn thế nữa.
        </p>
      </header>
      <PostList posts={data} />
      <Pagination page={page} totalPages={totalPages(total, PAGE_SIZE)} basePath="/" />
    </main>
  );
}
