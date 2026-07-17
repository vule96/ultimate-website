import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listTags } from "@/features/posts/api";
import { categoryColorForTag } from "@/features/magazine/categories";

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
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{t("kicker")}</p>
        <h1 className="mt-3 font-display text-[2.4rem] font-black leading-[1.12] tracking-[-0.01em] text-fg sm:text-[2.9rem]">
          {t("title")}
        </h1>
      </header>
      {tags.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {tags.map((tag) => {
            const color = categoryColorForTag(tag);
            return (
              <Link
                key={tag.slug}
                href={`/tags/${tag.slug}`}
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold no-underline transition-opacity hover:opacity-75"
                style={{
                  color,
                  background: `color-mix(in srgb, ${color} var(--tint-strength), transparent)`,
                }}
              >
                {tag.name}
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
