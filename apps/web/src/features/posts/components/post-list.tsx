import type { Post } from "@ultimate/types";
import { PostCard } from "./post-card";

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="text-muted-foreground">Chưa có bài viết nào.</p>;
  }
  return (
    <div className="grid gap-6">
      {posts.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
