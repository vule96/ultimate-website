import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listTags } from "@/features/posts/api";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "tagsPage" });
  return { title: t("metaTitle"), description: t("metaDesc") };
}

export default async function TagsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations("tagsPage");
  const tags = await listTags().catch(() => []);
  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <header className="mb-10">
        <p className="article-kicker">{t("kicker")}</p>
        <h1 className="article-title mt-3 text-[2.4rem] sm:text-[2.9rem]">{t("title")}</h1>
      </header>
      {tags.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {tags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/tags/${tag.slug}`}
              className="card-lift inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-[var(--shadow-card)] hover:text-primary"
            >
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
