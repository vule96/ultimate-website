import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@ultimate/ui";

/** Nút toolbar dùng chung cho cả Tiptap và Lexical (icon + trạng thái active). */
export function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()} // giữ selection trong editor
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Vạch ngăn nhóm nút trên toolbar. */
export function ToolbarDivider() {
  return <span className="mx-1 h-6 w-px bg-border" />;
}
