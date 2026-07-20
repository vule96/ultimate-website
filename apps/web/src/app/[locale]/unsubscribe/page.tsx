import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnsubscribeClient } from "@/features/magazine/components/unsubscribe-client";

// Public, không index (trang thao tác qua token). force-dynamic: không SSG.
export const dynamic = "force-dynamic";

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations({ locale: params.locale, namespace: "unsubscribe" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function UnsubscribePage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [params, sp] = await Promise.all([props.params, props.searchParams]);
  setRequestLocale(params.locale);
  const t = await getTranslations("unsubscribe");
  return (
    <main className="mx-auto max-w-xl px-5 py-16 sm:py-24">
      <h1 className="mb-6 font-display text-[2rem] font-black leading-[1.15] tracking-[-0.01em] text-fg">
        {t("title")}
      </h1>
      <UnsubscribeClient token={sp.token ?? ""} />
    </main>
  );
}
