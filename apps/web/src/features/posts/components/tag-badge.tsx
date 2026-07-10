import Link from "next/link";
import type { Tag } from "@ultimate/types";
import { Badge } from "@ultimate/ui";

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <Link href={`/tags/${tag.slug}`}>
      <Badge>{tag.name}</Badge>
    </Link>
  );
}
