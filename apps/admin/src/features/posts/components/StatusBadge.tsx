import { Badge } from "@ultimate/ui";
import type { PostStatus } from "@ultimate/types";

const map: Record<PostStatus, { text: string; variant: "published" | "draft" | "pending" }> = {
  PUBLISHED: { text: "Đã đăng", variant: "published" },
  DRAFT: { text: "Nháp", variant: "draft" },
  PENDING_APPROVAL: { text: "Chờ duyệt", variant: "pending" },
};

export function StatusBadge({ status }: { status: PostStatus }) {
  const s = map[status];
  return <Badge variant={s.variant}>{s.text}</Badge>;
}
