import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { listTags } from "@/features/posts/api";
import { PostsPage } from "@/features/posts/components/posts-page";
import { SITE_URL } from "@/lib/config";

export const revalidate = 60;

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return {
    title: `#${params.slug}`,
    description: `Các bài viết về chủ đề #${params.slug}.`,
    alternates: { canonical: `${SITE_URL}/tags/${params.slug}` },
  };
}

export async function generateStaticParams() {
  try {
    const tags = await listTags();
    return tags.map((t) => ({ slug: t.slug }));
  } catch {
    return [];
  }
}

export default function TagPage({ params }: { params: { locale: string; slug: string } }) {
  setRequestLocale(params.locale);
  return <PostsPage page={1} tag={params.slug} basePath={`/tags/${params.slug}`} />;
}
