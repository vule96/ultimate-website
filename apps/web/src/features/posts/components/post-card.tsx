import Link from "next/link";
import Image from "next/image";
import type { Post } from "@ultimate/types";
import { Card } from "@ultimate/ui";
import { TagBadge } from "./tag-badge";

export function PostCard({ post }: { post: Post }) {
  return (
    <Card className="overflow-hidden">
      <Link href={`/blog/${post.slug}`} className="block">
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt={post.title}
            width={800}
            height={420}
            className="h-48 w-full object-cover"
          />
        ) : null}
        <div className="p-5">
          <h2 className="text-xl font-semibold">{post.title}</h2>
          {post.excerpt ? (
            <p className="mt-2 text-muted-foreground">{post.excerpt}</p>
          ) : null}
        </div>
      </Link>
      {post.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {post.tags.map((t) => (
            <TagBadge key={t.slug} tag={t} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}
