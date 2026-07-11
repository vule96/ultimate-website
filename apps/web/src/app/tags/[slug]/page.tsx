import { listTags } from "@/features/posts/api";
import { PostsPage } from "@/features/posts/components/posts-page";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const tags = await listTags();
    return tags.map((t) => ({ slug: t.slug }));
  } catch {
    return [];
  }
}

export default function TagPage({ params }: { params: { slug: string } }) {
  return <PostsPage page={1} tag={params.slug} basePath={`/tags/${params.slug}`} />;
}
