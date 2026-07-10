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
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <header className="mb-8">
        <p className="article-kicker">Chủ đề</p>
        <h1 className="article-title mt-3 text-[2.4rem] sm:text-[2.9rem]">#{params.slug}</h1>
        <p className="mt-3 text-muted-foreground">{total} bài viết</p>
      </header>
      <PostList posts={data} />
      <Pagination
        page={page}
        totalPages={totalPages(total, PAGE_SIZE)}
        basePath={`/tags/${params.slug}`}
      />
    </main>
  );
}
