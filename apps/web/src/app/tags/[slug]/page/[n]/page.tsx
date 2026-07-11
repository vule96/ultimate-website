import { notFound } from "next/navigation";
import { listPublished, listTags } from "@/features/posts/api";
import { PostsPage } from "@/features/posts/components/posts-page";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

// Sinh cặp {slug, n} cho các trang 2+ của mỗi tag. Lỗi core → [] (degrade).
export async function generateStaticParams() {
  try {
    const tags = await listTags();
    const out: { slug: string; n: string }[] = [];
    for (const t of tags) {
      const { total } = await listPublished({ page: 1, tag: t.slug });
      const pages = totalPages(total, PAGE_SIZE);
      for (let p = 2; p <= pages; p++) out.push({ slug: t.slug, n: String(p) });
    }
    return out;
  } catch {
    return [];
  }
}

export default function TagPaged({ params }: { params: { slug: string; n: string } }) {
  const page = Number(params.n);
  if (!Number.isInteger(page) || page < 2) notFound();
  return <PostsPage page={page} tag={params.slug} basePath={`/tags/${params.slug}`} />;
}
