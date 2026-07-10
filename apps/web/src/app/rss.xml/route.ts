import { listAllPublished } from "@/features/posts/api";
import { buildRssXml } from "@/features/posts/rss";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const revalidate = 60;

export async function GET() {
  const posts = await listAllPublished().catch(() => []);
  const xml = buildRssXml(posts, SITE_URL, SITE_NAME);
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
