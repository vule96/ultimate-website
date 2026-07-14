import { listAllPublished } from "@/features/posts/api";
import { postsToArticleVMs } from "@/features/magazine/lib/article-vm";
import { MagazineBoard } from "@/features/magazine/components/magazine-board";

export const revalidate = 60;

export default async function HomePage() {
  const posts = await listAllPublished();
  const articles = postsToArticleVMs(posts);
  // Top xem nhiều: backend chưa có `views` → tạm lấy 5 bài mới nhất.
  const topViewed = articles.slice(0, 5);
  return <MagazineBoard articles={articles} topViewed={topViewed} />;
}
