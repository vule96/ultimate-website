import { memo } from "react";
import type { ArticleVM } from "../types";

function TopViewedListBase({
  items,
  onOpen,
}: {
  items: ArticleVM[];
  onOpen: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[15px]">
      {items.map((a, i) => (
        <div
          key={a.id}
          onClick={() => onOpen(a.slug)}
          className="flex cursor-pointer items-start gap-[13px]"
        >
          <span
            className="min-w-[26px] font-display text-[26px] font-extrabold leading-none"
            style={{ color: a.color }}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <h5 className="mb-1 text-[13.5px] font-semibold leading-[1.32] text-fg">{a.title}</h5>
            <span className="font-mono text-[10.5px] text-muted">{a.dateLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const TopViewedList = memo(TopViewedListBase);
