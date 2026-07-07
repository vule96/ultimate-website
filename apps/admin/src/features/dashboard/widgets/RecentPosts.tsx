import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePostsListSuspense } from "@/features/posts/queries";
import { StatusBadge } from "@/features/posts/components/StatusBadge";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(d);
}

export function RecentPosts() {
  const { data } = usePostsListSuspense({ page: 1, pageSize: 5 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bài viết gần đây</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {data.data.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">Chưa có bài viết.</p>
        )}
        {data.data.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <Link
                to="/posts/$slug/edit"
                params={{ slug: p.slug }}
                className="block truncate text-sm font-medium hover:underline"
              >
                {p.title}
              </Link>
              <p className="text-xs text-muted-foreground">{formatDate(p.updated_at)}</p>
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
