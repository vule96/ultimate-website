import type { ImageMeta } from "@ultimate/types";
import { sanitizeHtml } from "@/features/posts/sanitize";

// content_html do chủ blog (tin cậy) tạo từ editor — vẫn sanitize server-side (RSC)
// làm defense-in-depth (W7). imageMeta (Slice 12) enrich <img>: width/height
// chống CLS + blurhash placeholder. Chi phí trả 1 lần mỗi ISR render.
export async function PostContent({
  html,
  imageMeta,
}: {
  html: string;
  imageMeta?: Record<string, ImageMeta> | null;
}) {
  const clean = await sanitizeHtml(html, imageMeta);
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: clean }} />;
}
