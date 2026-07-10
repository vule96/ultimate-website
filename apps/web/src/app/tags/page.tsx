import Link from "next/link";
import { listTags } from "@/features/posts/api";
import { Badge } from "@ultimate/ui";

export const revalidate = 60;

export default async function TagsPage() {
  const tags = await listTags().catch(() => []);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">Tags</h1>
      {tags.length === 0 ? (
        <p className="text-muted-foreground">Chưa có tag nào.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((t) => (
            <Link key={t.slug} href={`/tags/${t.slug}`}>
              <Badge>{t.name}</Badge>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
