"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SubNav() {
  const t = useTranslations("subnav");
  return (
    <div className="border-b border-chrome-line bg-chrome-bg">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-5 px-5 py-[11px] sm:px-[30px]">
        <nav className="flex gap-[22px] overflow-x-auto text-[13.5px] font-semibold sm:gap-[26px]">
          <Link href="/" className="text-chrome-fg no-underline">
            {t("home")}
          </Link>
          <Link href="/tags" className="text-chrome-muted no-underline">
            {t("categories")}
          </Link>
          <Link href="/" className="text-chrome-muted no-underline">
            {t("explore")}
          </Link>
        </nav>
        <span className="hidden font-mono text-[11px] tracking-[0.06em] text-chrome-muted md:inline">
          {t("meta")}
        </span>
      </div>
    </div>
  );
}
