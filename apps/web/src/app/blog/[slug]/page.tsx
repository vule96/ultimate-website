import { notFound } from "next/navigation";
import { getPublishedBySlug, listAllPublished } from "@/features/posts/api";
import { PostContent } from "@/features/posts/components/post-content";
import { TagBadge } from "@/features/posts/components/tag-badge";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const posts = await listAllPublished();
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    // Core API không sẵn sàng lúc build → prerender rỗng, dựa ISR on-demand (dynamicParams=true).
    return [];
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPublishedBySlug(params.slug);
  if (!post) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold">{post.title}</h1>
      {post.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <TagBadge key={t.slug} tag={t} />
          ))}
        </div>
      ) : null}
      <div className="mt-8">
        <PostContent html={post.content_html} />
      </div>
    </main>
  );
}
