import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import type { UpsertPostInput, PostId } from "@ultimate/types";
import {
  listPosts,
  getPostBySlug,
  fetchStats,
  fetchTimeseries,
  createPost,
  updatePost,
  deletePost,
  type ListPostsParams,
} from "./api";
import { postKeys } from "./keys";
import { tagKeys } from "@/features/tags/keys";

// --- queryOptions (dùng chung cho route loader + component) ---
export const postsListQueryOptions = (params: ListPostsParams) =>
  queryOptions({
    queryKey: postKeys.list(params),
    queryFn: ({ signal }) => listPosts(params, signal),
    placeholderData: keepPreviousData,
  });

export const postQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: postKeys.detail(slug),
    queryFn: ({ signal }) => getPostBySlug(slug, signal),
  });

export const statsQueryOptions = () =>
  queryOptions({ queryKey: postKeys.stats(), queryFn: fetchStats });

export const timeseriesQueryOptions = (months = 8) =>
  queryOptions({ queryKey: postKeys.timeseries(months), queryFn: () => fetchTimeseries(months) });

// --- hooks component ---
export const usePostsQuery = (params: ListPostsParams) => useQuery(postsListQueryOptions(params));
export const usePostsListSuspense = (params: ListPostsParams) =>
  useSuspenseQuery(postsListQueryOptions(params));
export const usePostQuery = (slug: string | undefined) =>
  useQuery({ ...postQueryOptions(slug ?? ""), enabled: Boolean(slug) });
export const useStatsSuspense = () => useSuspenseQuery(statsQueryOptions());
export const useTimeseriesSuspense = (months = 8) =>
  useSuspenseQuery(timeseriesQueryOptions(months));

// Tạo/sửa post có thể tạo tag mới → invalidate cả posts lẫn tags (A5).
function invalidatePostsAndTags(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: postKeys.all });
  void qc.invalidateQueries({ queryKey: tagKeys.all });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertPostInput) => createPost(input),
    onSuccess: () => invalidatePostsAndTags(qc),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: PostId; input: UpsertPostInput }) => updatePost(id, input),
    onSuccess: () => invalidatePostsAndTags(qc),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: postKeys.all }),
  });
}
