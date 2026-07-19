import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import {
  createColumnHelper,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table";
import type { Post } from "@ultimate/types";
import { Button } from "@ultimate/ui";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "./StatusBadge";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(d);
}

const helper = createColumnHelper<Post>();

const columns = [
  helper.accessor("title", {
    header: "Tiêu đề",
    enableSorting: true,
    enableHiding: false,
    cell: (ctx) => {
      const p = ctx.row.original;
      return (
        <div className="max-w-xs">
          <Link
            to="/posts/$slug/edit"
            params={{ slug: p.slug }}
            className="font-medium hover:underline"
          >
            {p.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
        </div>
      );
    },
  }),
  helper.accessor("status", {
    header: "Trạng thái",
    enableSorting: true,
    cell: (ctx) => <StatusBadge status={ctx.getValue()} />,
  }),
  helper.display({
    id: "tags",
    header: "Tags",
    enableSorting: false,
    cell: (ctx) => {
      const tags = ctx.row.original.tags;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            tags.map((t) => (
              <span key={t.id} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                {t.name}
              </span>
            ))
          )}
        </div>
      );
    },
  }),
  helper.accessor("views", {
    header: "Lượt xem",
    enableSorting: true,
    cell: (ctx) => {
      const v = ctx.getValue();
      return (
        <span className="block text-right font-mono text-[13px] tabular-nums text-muted-foreground">
          {v > 0 ? v.toLocaleString("vi-VN") : "—"}
        </span>
      );
    },
  }),
  helper.accessor("updated_at", {
    header: "Cập nhật",
    enableSorting: true,
    cell: (ctx) => (
      <span className="whitespace-nowrap text-muted-foreground">{formatDate(ctx.getValue())}</span>
    ),
  }),
  helper.display({
    id: "actions",
    header: () => <span className="sr-only">Thao tác</span>,
    enableSorting: false,
    enableHiding: false,
    cell: (ctx) => {
      const p = ctx.row.original;
      const onDelete = ctx.table.options.meta?.onDelete;
      return (
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
            onClick={() => onDelete?.(p)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 />
          </Button>
        </div>
      );
    },
  }),
] as ColumnDef<Post, unknown>[];

export function PostsTable({
  posts,
  onDelete,
  sorting,
  onSortingChange,
}: {
  posts: Post[];
  onDelete: (post: Post) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}) {
  return (
    <DataTable
      columns={columns}
      data={posts}
      sorting={sorting}
      onSortingChange={onSortingChange}
      meta={{ onDelete }}
      emptyMessage="Chưa có bài viết nào."
    />
  );
}
