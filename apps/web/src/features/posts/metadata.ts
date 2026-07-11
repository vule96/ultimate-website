import type { Metadata } from "next";
import type { Post } from "@ultimate/types";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export function buildPostMetadata(post: Post): Metadata {
  const title = post.meta_title ?? post.title;
  const description = post.meta_desc ?? post.excerpt ?? "";
  const url = `${SITE_URL}/blog/${post.slug}`;
  const hasCover = Boolean(post.cover_image);
  const ogImage = post.cover_image ?? `${SITE_URL}/og-default.png`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: SITE_NAME,
      publishedTime: post.published_at ?? undefined,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: hasCover ? "summary_large_image" : "summary",
      title,
      description,
      images: [ogImage],
    },
  };
}
