"use client";
import { useTranslations } from "next-intl";
import { CATEGORIES } from "../categories";
import { useMagazineStore } from "../store/magazine-store";

/** Thanh category cuộn ngang — thay CategoryRail trên màn hình < lg. */
export function MobileCategoryBar() {
  const t = useTranslations("categories");
  const cat = useMagazineStore((s) => s.cat);
  const setCat = useMagazineStore((s) => s.setCat);
  return (
    <div className="border-b border-line bg-surface lg:hidden">
      <div className="mx-auto flex max-w-shell gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none]">
        {CATEGORIES.map((c) => {
          const active = c.key === cat;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className="whitespace-nowrap rounded-full px-[13px] py-[7px] text-[12.5px] font-semibold"
              style={
                active
                  ? { background: c.color, color: "#fff" }
                  : {
                      color: c.color,
                      background: `color-mix(in srgb, ${c.color} var(--tint-strength), transparent)`,
                    }
              }
            >
              {t(c.key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
