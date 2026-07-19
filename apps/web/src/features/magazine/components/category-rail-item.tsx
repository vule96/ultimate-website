import { memo } from "react";
import { useTranslations } from "next-intl";
import type { Category } from "../types";

interface Props {
  category: Category;
  active: boolean;
  onSelect: (key: Category["key"]) => void;
}

function CategoryRailItemBase({ category, active, onSelect }: Props) {
  const t = useTranslations("categories");
  const tint = `color-mix(in srgb, ${category.color} var(--tint-strength), transparent)`;
  return (
    <button
      type="button"
      onClick={() => onSelect(category.key)}
      className="relative rounded-[9px] py-[11px] pl-[15px] pr-[13px] text-left text-[14px] font-semibold text-fg transition-colors hover:bg-soft"
      style={active ? { color: category.color, background: tint } : undefined}
    >
      {/* Thanh màu category = tín hiệu phân loại (không phải trang trí như icon cũ). */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-[16px] w-[3px] -translate-y-1/2 rounded-full"
          style={{ background: category.color }}
        />
      )}
      {t(category.key)}
    </button>
  );
}

export const CategoryRailItem = memo(CategoryRailItemBase);
