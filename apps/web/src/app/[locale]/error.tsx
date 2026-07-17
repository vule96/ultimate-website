"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">500</p>
      <h1 className="mt-3 font-display text-[2.4rem] font-black leading-[1.12] tracking-[-0.01em] text-fg">{t("errorTitle")}</h1>
      <p className="mt-4 text-muted">{t("errorDesc")}</p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("retry")}
        </button>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-accent hover:opacity-75"
        >
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
