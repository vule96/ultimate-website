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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">Bài viết mới nhất</h1>
      <PostList posts={data} />
      <Pagination page={page} totalPages={totalPages(total, PAGE_SIZE)} basePath="/" />
    </main>
  );
}
