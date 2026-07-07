import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import type { Post } from "@ultimate/types";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(d);
}

export function PostsTable({
  posts,
  onDelete,
}: {
  posts: Post[];
  onDelete: (post: Post) => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        Chưa có bài viết nào.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/40 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Tiêu đề</th>
            <th className="px-4 py-3 font-medium">Trạng thái</th>
            <th className="px-4 py-3 font-medium">Tags</th>
            <th className="px-4 py-3 font-medium">Cập nhật</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {posts.map((p) => (
            <tr key={p.id} className="hover:bg-secondary/30">
              <td className="max-w-xs px-4 py-3">
                <Link
                  to="/posts/$slug/edit"
                  params={{ slug: p.slug }}
                  className="font-medium hover:underline"
                >
                  {p.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {p.tags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    p.tags.map((t) => (
                      <span key={t.id} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                        {t.name}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                {formatDate(p.updated_at)}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button asChild variant="ghost" size="icon" aria-label="Sửa">
                    <Link to="/posts/$slug/edit" params={{ slug: p.slug }}>
                      <Pencil />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Xoá"
                    onClick={() => onDelete(p)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
