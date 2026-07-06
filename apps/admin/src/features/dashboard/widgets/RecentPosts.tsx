import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePostsQuery } from "@/features/posts/queries";
import { StatusBadge } from "@/features/posts/components/StatusBadge";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(d);
}

export function RecentPosts() {
  const query = usePostsQuery({ page: 1, pageSize: 5 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bài viết gần đây</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {query.isPending && <p className="py-3 text-sm text-muted-foreground">Đang tải…</p>}
        {query.isError && <p className="py-3 text-sm text-red-600">Không tải được.</p>}
        {query.isSuccess && query.data.data.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">Chưa có bài viết.</p>
        )}
        {query.isSuccess &&
          query.data.data.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <Link
                  to={`/posts/${p.slug}/edit`}
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
