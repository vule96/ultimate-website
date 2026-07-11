import { PostsPage } from "@/features/posts/components/posts-page";

export const revalidate = 60;

export default function HomePage() {
  return <PostsPage page={1} basePath="/" />;
}
