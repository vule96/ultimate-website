export function PostContent({ html }: { html: string }) {
  // content_html do chủ blog (tin cậy) tạo từ editor — chưa sanitize (xem spec §1).
  return (
    <article
      className="prose prose-neutral max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
