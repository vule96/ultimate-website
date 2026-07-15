"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/use-theme";
import { SearchBar } from "./search-bar";
import { AuthMenu } from "./auth-menu";

export function Masthead() {
  const { dark, toggle } = useTheme();
  return (
    <header className="border-b border-chrome-line bg-chrome-bg text-chrome-fg">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-[22px] px-[30px] py-5">
        <div className="flex items-baseline gap-[14px]">
          <span className="font-display text-[34px] font-extrabold leading-[0.9] tracking-[-0.015em] text-accent">
            Mạch
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-chrome-muted">
            Tạp chí tri thức
          </span>
        </div>
        <SearchBar />
        <div className="flex items-center gap-[10px]">
          <button
            onClick={toggle}
            aria-label="Đổi giao diện sáng/tối"
            className="flex items-center gap-[7px] rounded-lg border border-chrome-line bg-soft px-[13px] py-[9px] text-[12.5px] font-semibold text-chrome-fg"
          >
            {dark ? <Sun size={13} /> : <Moon size={13} />}
            {dark ? "Sáng" : "Tối"}
          </button>
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
