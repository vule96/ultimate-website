import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAllPublished, listTopViewed } from "@/features/posts/api";
import { buildSafe } from "@/features/posts/build-safe";
import { postsToArticleVMs, type ArticleVMLabels } from "@/features/magazine/lib/article-vm";
import { NewsroomBoard } from "@/features/magazine/components/newsroom-board";

// force-dynamic: trang chủ fetch danh sách bài lúc render. Nếu để SSG/ISR thì
// build Docker (BUILD_WITHOUT_API=1 → buildSafe trả []) bake bản RỖNG, ISR phục vụ
// stale rỗng ở lần vào đầu → "Không tìm thấy bài viết". Dynamic = luôn fetch thật,
// SEO vẫn full SSR HTML (Cloudflare cache edge về sau).
export const dynamic = "force-dynamic";

export default async function HomePage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  setRequestLocale(params.locale);
  const [posts, top, t] = await Promise.all([
    buildSafe(() => listAllPublished(), []),
    buildSafe(() => listTopViewed(5), []),
    getTranslations(),
  ]);
  const labels: ArticleVMLabels = {
    category: (key) => t(`categories.${key}`),
    readTime: (minutes) => t("list.readTime", { minutes }),
  };
  const articles = postsToArticleVMs(posts, labels);
  // Top xem nhiều: views thật từ core (sort=views) — fallback 5 bài mới nhất
  // khi chưa có dữ liệu (build không API / DB mới).
  const topViewed = top.length > 0 ? postsToArticleVMs(top, labels) : articles.slice(0, 5);
  return <NewsroomBoard articles={articles} topViewed={topViewed} />;
}
