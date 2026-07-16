/**
 * buildSafe: nuốt lỗi fetch CHỈ khi build image không có API
 * (Docker set BUILD_WITHOUT_API=1 ở stage build) — prerender fallback rỗng,
 * ISR tự chữa trong ≤ revalidate khi chạy thật.
 * Runtime (env không set): rethrow — giữ nguyên hành vi "throw để ISR giữ
 * bản tốt cuối" của sitemap/rss (Slice 5c).
 */
export async function buildSafe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (process.env.BUILD_WITHOUT_API === "1") return fallback;
    throw err;
  }
}
