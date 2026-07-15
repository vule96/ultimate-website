import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { listPublished } from "@/features/posts/api";
import { PostsPage } from "@/features/posts/components/posts-page";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

// Sinh sẵn các trang 2..N lúc build (trang 1 là "/"). Lỗi core → [] (degrade).
export async function generateStaticParams() {
  try {
    const { total } = await listPublished({ page: 1 });
    const pages = totalPages(total, PAGE_SIZE);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ n: String(i + 2) }));
  } catch {
    return [];
  }
}

export default function HomePaged({ params }: { params: { locale: string; n: string } }) {
  setRequestLocale(params.locale);
  const page = Number(params.n);
  if (!Number.isInteger(page) || page < 2) notFound();
  return <PostsPage page={page} basePath="/" />;
}
