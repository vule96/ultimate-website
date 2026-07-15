"use client";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LangSwitcher() {
  const locale = useLocale();
  const t = useTranslations("masthead");
  const pathname = usePathname();
  const router = useRouter();
  const next = locale === "vi" ? "en" : "vi";
  return (
    <button
      onClick={() => router.replace(pathname, { locale: next })}
      aria-label={t("langSwitchAria")}
      className="rounded-lg border border-chrome-line bg-soft px-[13px] py-[9px] font-mono text-[11px] font-bold uppercase text-chrome-fg"
    >
      {next}
    </button>
  );
}
