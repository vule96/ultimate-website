import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { recentPosts } from "../mockData";
import type { PostStatus } from "@ultimate/types";

const statusLabel: Record<PostStatus, { text: string; variant: "published" | "draft" | "pending" }> = {
  PUBLISHED: { text: "Đã đăng", variant: "published" },
  DRAFT: { text: "Nháp", variant: "draft" },
  PENDING_APPROVAL: { text: "Chờ duyệt", variant: "pending" },
};

export function RecentPosts() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bài viết gần đây</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {recentPosts.map((p) => {
          const s = statusLabel[p.status];
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.date}</p>
              </div>
              <Badge variant={s.variant}>{s.text}</Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
