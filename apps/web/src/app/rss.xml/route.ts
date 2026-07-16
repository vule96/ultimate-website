import { listAllPublished } from "@/features/posts/api";
import { buildSafe } from "@/features/posts/build-safe";
import { buildRssXml } from "@/features/posts/rss";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const revalidate = 60;

export async function GET() {
  // Runtime: để lỗi throw (ISR giữ feed tốt cuối) — không publish feed rỗng khi
  // core down. Build image không có API (BUILD_WITHOUT_API=1): fallback rỗng.
  const posts = await buildSafe(() => listAllPublished(), []);
  const xml = buildRssXml(posts, SITE_URL, SITE_NAME);
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
