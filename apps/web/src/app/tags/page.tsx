import Link from "next/link";
import { listTags } from "@/features/posts/api";

export const revalidate = 60;

export default async function TagsPage() {
  const tags = await listTags().catch(() => []);
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <header className="mb-10">
        <p className="article-kicker">Chủ đề</p>
        <h1 className="article-title mt-3 text-[2.4rem] sm:text-[2.9rem]">Tags</h1>
      </header>
      {tags.length === 0 ? (
        <p className="text-muted-foreground">Chưa có tag nào.</p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {tags.map((t) => (
            <Link
              key={t.slug}
              href={`/tags/${t.slug}`}
              className="card-lift inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-[var(--shadow-card)] hover:text-primary"
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
