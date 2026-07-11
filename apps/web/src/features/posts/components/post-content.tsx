import { sanitizeHtml } from "@/features/posts/sanitize";

// content_html do chủ blog (tin cậy) tạo từ editor — vẫn sanitize server-side (RSC)
// làm defense-in-depth (W7). Chi phí trả 1 lần mỗi ISR render.
export async function PostContent({ html }: { html: string }) {
  const clean = await sanitizeHtml(html);
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: clean }} />;
}
