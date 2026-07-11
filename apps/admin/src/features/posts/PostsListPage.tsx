import { useEffect, useState } from "react";
import { getRouteApi } from "@tanstack/react-router";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import type { Post } from "@ultimate/types";
import { Button } from "@ultimate/ui";
import { useToast } from "@ultimate/ui";
import { ApiError } from "@/lib/apiClient";
import { usePostsListSuspense, useDeletePost } from "./queries";
import { useTagsSuspense } from "@/features/tags/api";
import { PostsToolbar } from "./components/PostsToolbar";
import { PostsTable } from "./components/PostsTable";
import { DeleteDialog } from "./components/DeleteDialog";

const route = getRouteApi("/_authed/posts/");
const PAGE_SIZE = 10;

export function PostsListPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();

  const postsQuery = usePostsListSuspense({
    page: search.page,
    pageSize: PAGE_SIZE,
    status: search.status,
    tag: search.tag,
    q: search.q,
    sort: search.sort,
    order: search.order,
  });

  // Sorting server-side: state suy từ URL, đổi → điều hướng cập nhật sort/order.
  const sorting: SortingState = [{ id: search.sort, desc: search.order === "desc" }];
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const first = next[0];
    void navigate({
      search: (p) => ({
        ...p,
        sort: (first?.id as typeof p.sort) ?? "created_at",
        order: first ? (first.desc ? "desc" : "asc") : "desc",
        page: 1,
      }),
    });
  };
  const tagsQuery = useTagsSuspense();
  const deleteMutation = useDeletePost();
  const { toast } = useToast();

  // Search có debounce: gõ cập nhật input ngay, URL cập nhật sau 300ms.
  const [searchInput, setSearchInput] = useState(search.q);
  useEffect(() => setSearchInput(search.q), [search.q]);
  useEffect(() => {
    if (searchInput === search.q) return;
    const id = window.setTimeout(() => {
      void navigate({ search: (p) => ({ ...p, q: searchInput, page: 1 }) });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const [toDelete, setToDelete] = useState<Post | null>(null);

  function confirmDelete() {
    if (!toDelete) return;
    deleteMutation.mutate(toDelete.id, {
      onSuccess: () => {
        toast(`Đã xoá “${toDelete.title}”.`);
        setToDelete(null);
      },
      onError: (err) => toast(err instanceof ApiError ? err.message : "Xoá thất bại.", "error"),
    });
  }

  const total = postsQuery.data.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bài viết</h2>
        <p className="mt-1 text-muted-foreground">Quản lý toàn bộ bài viết của blog.</p>
      </div>

      <PostsToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={search.status}
        onStatusChange={(v) =>
          void navigate({ search: (p) => ({ ...p, status: v, page: 1 }) })
        }
        tag={search.tag}
        onTagChange={(v) => void navigate({ search: (p) => ({ ...p, tag: v, page: 1 }) })}
        tags={tagsQuery.data}
      />

      <PostsTable
        posts={postsQuery.data.data}
        onDelete={setToDelete}
        sorting={sorting}
        onSortingChange={onSortingChange}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} bài viết · Trang {search.page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={search.page <= 1}
            onClick={() => void navigate({ search: (p) => ({ ...p, page: p.page - 1 }) })}
          >
            Trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={search.page >= totalPages}
            onClick={() => void navigate({ search: (p) => ({ ...p, page: p.page + 1 }) })}
          >
            Sau
          </Button>
        </div>
      </div>

      <DeleteDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete?.title ?? ""}
        onConfirm={confirmDelete}
        pending={deleteMutation.isPending}
      />
    </div>
  );
}
