import { memo } from "react";
import type { Category, CategoryKey } from "../types";

function TrendingChipsBase({
  categories,
  onSelect,
}: {
  categories: Category[];
  onSelect: (k: CategoryKey) => void;
}) {
  return (
    <div className="mb-[30px] flex flex-wrap gap-2">
      {categories.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onSelect(c.key)}
          className="rounded-[7px] px-[13px] py-2 text-[12.5px] font-bold"
          style={{
            color: c.color,
            background: `color-mix(in srgb, ${c.color} var(--tint-strength), transparent)`,
          }}
        >
          #{c.label}
        </button>
      ))}
    </div>
  );
}

export const TrendingChips = memo(TrendingChipsBase);
