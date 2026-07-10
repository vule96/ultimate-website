/** Định dạng ngày kiểu Việt: "7 tháng 7, 2026". Rỗng nếu không có ngày. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Ước lượng thời gian đọc (phút) từ HTML nội dung, ~200 từ/phút. Tối thiểu 1. */
export function readingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
