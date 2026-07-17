import type { Post } from "@ultimate/types";
import { PostCard } from "./post-card";

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-16 text-center text-muted">
        Chưa có bài viết nào.
      </div>
    );
  }
  return (
    <div>
      {posts.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
