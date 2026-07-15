"use client";
import { useTranslations } from "next-intl";
import { CATEGORIES } from "../categories";
import { useMagazineStore } from "../store/magazine-store";
import { CategoryRailItem } from "./category-rail-item";

export function CategoryRail() {
  const t = useTranslations("rail");
  const cat = useMagazineStore((s) => s.cat);
  const setCat = useMagazineStore((s) => s.setCat);
  return (
    <nav className="hidden w-[224px] flex-none border-r border-line bg-surface px-[18px] py-6 lg:block">
      <div className="mx-[6px] mb-[13px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {t("heading")}
      </div>
      <div className="flex flex-col gap-1">
        {CATEGORIES.map((c) => (
          <CategoryRailItem key={c.key} category={c} active={c.key === cat} onSelect={setCat} />
        ))}
      </div>
    </nav>
  );
}
