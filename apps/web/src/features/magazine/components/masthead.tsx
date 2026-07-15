"use client";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "../hooks/use-theme";
import { SearchBar } from "./search-bar";
import { AuthMenu } from "./auth-menu";
import { LangSwitcher } from "./lang-switcher";

export function Masthead() {
  const { dark, toggle } = useTheme();
  const t = useTranslations("masthead");
  return (
    <header className="border-b border-chrome-line bg-chrome-bg text-chrome-fg">
      <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-x-[22px] gap-y-3 px-5 py-4 sm:px-[30px] sm:py-5">
        <div className="flex items-baseline gap-[14px]">
          <span className="font-display text-[30px] font-extrabold leading-[0.9] tracking-[-0.015em] text-accent sm:text-[34px]">
            Mạch
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-chrome-muted sm:inline">
            {t("tagline")}
          </span>
        </div>
        <SearchBar />
        <div className="flex items-center gap-[10px]">
          <LangSwitcher />
          <button
            onClick={toggle}
            aria-label={t("themeToggleAria")}
            className="flex items-center gap-[7px] rounded-lg border border-chrome-line bg-soft px-[13px] py-[9px] text-[12.5px] font-semibold text-chrome-fg"
          >
            {dark ? <Sun size={13} /> : <Moon size={13} />}
            {dark ? t("themeLight") : t("themeDark")}
          </button>
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
