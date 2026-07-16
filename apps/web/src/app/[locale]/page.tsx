import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAllPublished } from "@/features/posts/api";
import { buildSafe } from "@/features/posts/build-safe";
import { postsToArticleVMs } from "@/features/magazine/lib/article-vm";
import { MagazineBoard } from "@/features/magazine/components/magazine-board";

export const revalidate = 60;

export default async function HomePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const [posts, t] = await Promise.all([
    buildSafe(() => listAllPublished(), []),
    getTranslations(),
  ]);
  const articles = postsToArticleVMs(posts, {
    category: (key) => t(`categories.${key}`),
    readTime: (minutes) => t("list.readTime", { minutes }),
  });
  // Top xem nhiều: backend chưa có `views` → tạm lấy 5 bài mới nhất.
  const topViewed = articles.slice(0, 5);
  return <MagazineBoard articles={articles} topViewed={topViewed} />;
}
