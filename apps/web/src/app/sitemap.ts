import type { MetadataRoute } from "next";
import { listAllPublished, listTags } from "@/features/posts/api";
import { buildSafe } from "@/features/posts/build-safe";
import { SITE_URL } from "@/lib/config";

export const revalidate = 60;

// vi mặc định không prefix; en dưới /en (localePrefix as-needed).
const withAlternates = (path: string, lastModified?: string) => ({
  url: `${SITE_URL}${path}`,
  ...(lastModified ? { lastModified } : {}),
  alternates: {
    languages: { vi: `${SITE_URL}${path}`, en: `${SITE_URL}/en${path}` },
  },
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Để lỗi throw: khi core sập lúc revalidate, ISR giữ bản sitemap tốt cuối
  // (chỉ rỗng ở first build). Nuốt lỗi ở đây sẽ publish sitemap rỗng cho crawler.
  const [posts, tags] = await buildSafe(
    () => Promise.all([listAllPublished(), listTags()]),
    [[], []],
  );
  return [
    withAlternates(""),
    withAlternates("/tags"),
    ...tags.map((t) => withAlternates(`/tags/${t.slug}`)),
    ...posts.map((p) => withAlternates(`/blog/${p.slug}`, p.updated_at)),
  ];
}
