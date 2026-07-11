import type { MetadataRoute } from "next";
import { listAllPublished, listTags } from "@/features/posts/api";
import { SITE_URL } from "@/lib/config";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Để lỗi throw: khi core sập lúc revalidate, ISR giữ bản sitemap tốt cuối
  // (chỉ rỗng ở first build). Nuốt lỗi ở đây sẽ publish sitemap rỗng cho crawler.
  const [posts, tags] = await Promise.all([listAllPublished(), listTags()]);
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/tags` },
    ...tags.map((t) => ({ url: `${SITE_URL}/tags/${t.slug}` })),
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated_at,
    })),
  ];
}
