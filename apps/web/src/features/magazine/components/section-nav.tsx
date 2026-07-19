"use client";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { SECTIONS } from "../sections";

/**
 * Điều hướng chuyên mục (newsroom) — gạch chân cam-đỏ cho mục đang mở.
 * Section trỏ tới band tương ứng trên trang chủ (`/#sec-<key>`).
 */
export function SectionNav() {
  const t = useTranslations("sections");
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isTopics = pathname.startsWith("/tags");

  const base =
    "flex items-center border-b-[3px] px-[15px] text-[13.5px] font-bold whitespace-nowrap transition-colors";
  const active = "border-brand text-brand";
  const idle = "border-transparent text-chrome-muted hover:text-chrome-fg";

  return (
    <div className="border-b border-line-strong bg-chrome-bg">
      <nav className="mx-auto flex h-11 max-w-shell items-stretch gap-0.5 overflow-x-auto px-5 sm:px-[30px]">
        <Link href="/" className={`${base} ${isHome ? active : idle}`}>
          {t("home")}
        </Link>
        {SECTIONS.map((s) => (
          <Link key={s.key} href={`/#sec-${s.key}`} className={`${base} ${idle}`}>
            {t(s.key)}
          </Link>
        ))}
        <Link href="/tags" className={`${base} ${isTopics ? active : idle}`}>
          {t("topics")}
        </Link>
      </nav>
    </div>
  );
}
