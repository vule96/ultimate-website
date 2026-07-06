import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Post, PostStatus } from "@ultimate/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/apiClient";
import { usePostsQuery, useTagsQuery, useDeletePost } from "./queries";
import { PostsToolbar } from "./components/PostsToolbar";
import { PostsTable } from "./components/PostsTable";
import { DeleteDialog } from "./components/DeleteDialog";

const PAGE_SIZE = 10;

export function PostsListPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const status = params.get("status") ?? "";
  const tag = params.get("tag") ?? "";
  const q = params.get("q") ?? "";

  // Search có debounce: gõ cập nhật input ngay, URL cập nhật sau 300ms.
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => setSearchInput(q), [q]);
  useEffect(() => {
    if (searchInput === q) return;
    const id = window.setTimeout(() => updateParams({ q: searchInput }), 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function updateParams(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page"); // đổi filter → về trang 1
    setParams(next);
  }

  const postsQuery = usePostsQuery({
    page,
    pageSize: PAGE_SIZE,
    status: status as PostStatus | "",
    tag,
    q,
  });
  const tagsQuery = useTagsQuery();
  const deleteMutation = useDeletePost();
  const { toast } = useToast();

  const [toDelete, setToDelete] = useState<Post | null>(null);

  function confirmDelete() {
    if (!toDelete) return;
    deleteMutation.mutate(toDelete.id, {
      onSuccess: () => {
        toast(`Đã xoá “${toDelete.title}”.`);
        setToDelete(null);
      },
      onError: (err) => {
        toast(err instanceof ApiError ? err.message : "Xoá thất bại.", "error");
      },
    });
  }

  const total = postsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bài viết</h2>
          <p className="mt-1 text-muted-foreground">Quản lý toàn bộ bài viết của blog.</p>
        </div>
      </div>

      <PostsToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={status}
        onStatusChange={(v) => updateParams({ status: v })}
        tag={tag}
        onTagChange={(v) => updateParams({ tag: v })}
        tags={tagsQuery.data ?? []}
      />

      {postsQuery.isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 text-sm text-red-700">
          Không tải được danh sách bài viết.{" "}
          <button className="underline" onClick={() => postsQuery.refetch()}>
            Thử lại
          </button>
        </div>
      ) : postsQuery.isPending ? (
        <div className="py-16 text-center text-sm text-muted-foreground" role="status">
          Đang tải…
        </div>
      ) : (
        <>
          <PostsTable posts={postsQuery.data.data} onDelete={setToDelete} />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} bài viết · Trang {page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Sau
              </Button>
            </div>
          </div>
        </>
      )}

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
