import {
  PostSchema,
  PostListResponseSchema,
  PostStatsSchema,
  PostTimeseriesSchema,
  type Post,
  type PostListResponse,
  type PostStats,
  type PostTimeseries,
  type PostStatus,
  type PostSortField,
  type SortOrder,
  type UpsertPostInput,
  type PostId,
} from "@ultimate/types";
import { apiFetch } from "@/lib/apiClient";

/** Tham số truy vấn danh sách bài viết. */
export interface ListPostsParams {
  page?: number;
  pageSize?: number;
  status?: PostStatus | "";
  tag?: string;
  q?: string;
  sort?: PostSortField;
  order?: SortOrder;
}

/** Dựng query string, bỏ qua các field rỗng/không xác định. */
export function buildPostsQuery(params: ListPostsParams): string {
  const sp = new URLSearchParams();
  if (params.page && params.page > 0) sp.set("page", String(params.page));
  if (params.pageSize && params.pageSize > 0) sp.set("page_size", String(params.pageSize));
  if (params.status) sp.set("status", params.status);
  if (params.tag) sp.set("tag", params.tag);
  const q = params.q?.trim();
  if (q) sp.set("q", q);
  // Chỉ gửi sort/order khi khác mặc định (created_at desc) để URL gọn.
  if (params.sort && !(params.sort === "created_at" && (params.order ?? "desc") === "desc")) {
    sp.set("sort", params.sort);
    sp.set("order", params.order ?? "desc");
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function listPosts(params: ListPostsParams, signal?: AbortSignal): Promise<PostListResponse> {
  return apiFetch(
    `/api/v1/posts${buildPostsQuery(params)}`,
    PostListResponseSchema,
    signal ? { signal } : undefined,
  );
}

export function getPostBySlug(slug: string, signal?: AbortSignal): Promise<Post> {
  return apiFetch(
    `/api/v1/posts/${encodeURIComponent(slug)}`,
    PostSchema,
    signal ? { signal } : undefined,
  );
}

export function fetchStats(): Promise<PostStats> {
  return apiFetch("/api/v1/posts/stats", PostStatsSchema);
}

export function fetchTimeseries(months = 8): Promise<PostTimeseries> {
  return apiFetch(`/api/v1/posts/stats/timeseries?months=${months}`, PostTimeseriesSchema);
}

export function createPost(input: UpsertPostInput): Promise<Post> {
  return apiFetch("/api/v1/posts", PostSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePost(id: PostId, input: UpsertPostInput): Promise<Post> {
  return apiFetch(`/api/v1/posts/${encodeURIComponent(id)}`, PostSchema, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deletePost(id: string): Promise<void> {
  return apiFetch(`/api/v1/posts/${encodeURIComponent(id)}`, null, {
    method: "DELETE",
  });
}
