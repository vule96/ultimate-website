"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="article-kicker">500</p>
      <h1 className="article-title mt-3 text-[2.4rem]">{t("errorTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("errorDesc")}</p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t("retry")}
        </button>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-primary hover:opacity-75"
        >
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
