"use client";
import { CATEGORIES } from "../categories";
import { useMagazineStore } from "../store/magazine-store";
import { CategoryRailItem } from "./category-rail-item";
import { NewsletterBox } from "./newsletter-box";

export function CategoryRail() {
  const cat = useMagazineStore((s) => s.cat);
  const setCat = useMagazineStore((s) => s.setCat);
  return (
    <nav className="w-[224px] flex-none border-r border-line bg-surface px-[18px] py-6">
      <div className="mx-[6px] mb-[13px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        Lĩnh vực
      </div>
      <div className="flex flex-col gap-1">
        {CATEGORIES.map((c) => (
          <CategoryRailItem key={c.key} category={c} active={c.key === cat} onSelect={setCat} />
        ))}
      </div>
      <NewsletterBox variant="rail" />
    </nav>
  );
}
