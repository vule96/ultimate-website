import { memo } from "react";
import type { Category } from "../types";

interface Props {
  category: Category;
  active: boolean;
  onSelect: (key: Category["key"]) => void;
}

function CategoryRailItemBase({ category, active, onSelect }: Props) {
  const Icon = category.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(category.key)}
      className="flex items-center gap-[11px] rounded-[9px] px-[13px] py-[12px] text-left text-[13.5px] font-semibold transition-colors"
      style={
        active
          ? { background: category.color, color: "#fff", boxShadow: `0 6px 16px ${category.color}52` }
          : undefined
      }
    >
      <Icon size={16} strokeWidth={2} style={{ color: active ? "#fff" : category.color }} />
      <span className={active ? "text-white" : "text-fg"}>{category.label}</span>
    </button>
  );
}

export const CategoryRailItem = memo(CategoryRailItemBase);
