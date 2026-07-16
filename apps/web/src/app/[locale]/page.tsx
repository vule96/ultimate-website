import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAllPublished, listTopViewed } from "@/features/posts/api";
import { buildSafe } from "@/features/posts/build-safe";
import { postsToArticleVMs, type ArticleVMLabels } from "@/features/magazine/lib/article-vm";
import { MagazineBoard } from "@/features/magazine/components/magazine-board";

export const revalidate = 60;

export default async function HomePage({ params }: { params: { locale: string } }) {
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
  return <MagazineBoard articles={articles} topViewed={topViewed} />;
}
