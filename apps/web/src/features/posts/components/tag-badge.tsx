import { Link } from "@/i18n/navigation";
import type { Tag } from "@ultimate/types";
import { sectionColorForTag } from "@/features/magazine/sections";

/** Chip tag newsroom: tint màu section (theme-aware); tag lạ → brand. */
export function TagBadge({ tag }: { tag: Tag }) {
  const color = sectionColorForTag(tag);
  return (
    <Link
      href={`/tags/${tag.slug}`}
      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold no-underline transition-opacity hover:opacity-75"
      style={{
        color,
        background: `color-mix(in srgb, ${color} var(--tint-strength), transparent)`,
      }}
    >
      {tag.name}
    </Link>
  );
}
