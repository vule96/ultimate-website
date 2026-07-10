import type { Post } from "@ultimate/types";
import { PostCard } from "./post-card";

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
        Chưa có bài viết nào.
      </div>
    );
  }
  return (
    <div className="divide-y divide-border">
      {posts.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
