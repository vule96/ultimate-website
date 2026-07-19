"use client";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useTheme } from "../hooks/use-theme";
import { SearchBar } from "./search-bar";
import { AuthMenu } from "./auth-menu";
import { LangSwitcher } from "./lang-switcher";

export function Masthead() {
  const { dark, toggle } = useTheme();
  const t = useTranslations("masthead");
  return (
    <>
      <div className="h-[3px] bg-brand" />
      <header className="border-b border-chrome-line bg-chrome-bg text-chrome-fg">
        <div className="mx-auto flex max-w-shell flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-[30px]">
          <Link href="/" className="flex items-baseline gap-[11px] no-underline">
            <span className="font-display text-[29px] font-black leading-none tracking-[-0.03em] text-chrome-fg sm:text-[31px]">
              M<span className="text-brand">ạ</span>ch
            </span>
            <span className="hidden text-[11px] uppercase tracking-[0.14em] text-faint sm:inline">
              {t("tagline")}
            </span>
          </Link>
          <div className="flex flex-1 items-center justify-end gap-[10px]">
            <SearchBar />
            <LangSwitcher />
            <button
              onClick={toggle}
              aria-label={t("themeToggleAria")}
              className="flex flex-none items-center gap-[7px] rounded-lg border border-line-strong bg-surface px-[12px] py-[9px] text-[12.5px] font-semibold text-chrome-muted hover:text-chrome-fg"
            >
              {dark ? <Sun size={13} /> : <Moon size={13} />}
              <span className="hidden sm:inline">{dark ? t("themeLight") : t("themeDark")}</span>
            </button>
            <AuthMenu />
          </div>
        </div>
      </header>
    </>
  );
}
