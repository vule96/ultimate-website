import { listPublished, listTags } from "@/features/posts/api";
import { PostList } from "@/features/posts/components/post-list";
import { Pagination } from "@/features/posts/components/pagination";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const tags = await listTags();
    return tags.map((t) => ({ slug: t.slug }));
  } catch {
    return [];
  }
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { data, total } = await listPublished({ page, tag: params.slug });
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">#{params.slug}</h1>
      <PostList posts={data} />
      <Pagination
        page={page}
        totalPages={totalPages(total, PAGE_SIZE)}
        basePath={`/tags/${params.slug}`}
      />
    </main>
  );
}
