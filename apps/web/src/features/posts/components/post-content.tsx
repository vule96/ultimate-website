export function PostContent({ html }: { html: string }) {
  // content_html do chủ blog (tin cậy) tạo từ editor — chưa sanitize (xem spec §1).
  return (
    <div
      className="article-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
