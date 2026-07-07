import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import type { UpsertPostInput } from "@ultimate/types";
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

// --- queryOptions (dùng chung cho route loader + component) ---
export const postsListQueryOptions = (params: ListPostsParams) =>
  queryOptions({
    queryKey: postKeys.list(params),
    queryFn: () => listPosts(params),
    placeholderData: keepPreviousData,
  });

export const postQueryOptions = (slug: string) =>
  queryOptions({ queryKey: postKeys.detail(slug), queryFn: () => getPostBySlug(slug) });

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

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertPostInput) => createPost(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: postKeys.all }),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertPostInput }) => updatePost(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: postKeys.all }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: postKeys.all }),
  });
}
