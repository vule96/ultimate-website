import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import type { UpsertPostInput } from "@ultimate/types";
import {
  listPosts,
  getPostBySlug,
  fetchStats,
  createPost,
  updatePost,
  deletePost,
  type ListPostsParams,
} from "./api";
import { listTags } from "@/features/tags/api";
import { postKeys, tagKeys } from "./keys";

export function usePostsQuery(params: ListPostsParams) {
  return useQuery({
    queryKey: postKeys.list(params),
    queryFn: () => listPosts(params),
    placeholderData: keepPreviousData, // giữ trang cũ khi đổi filter/trang → đỡ nhấp nháy
  });
}

export function usePostQuery(slug: string | undefined) {
  return useQuery({
    queryKey: postKeys.detail(slug ?? ""),
    queryFn: () => getPostBySlug(slug as string),
    enabled: Boolean(slug),
  });
}

export function useStatsQuery() {
  return useQuery({ queryKey: postKeys.stats(), queryFn: fetchStats });
}

export function useTagsQuery() {
  return useQuery({ queryKey: tagKeys.list(), queryFn: listTags });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertPostInput) => createPost(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertPostInput }) => updatePost(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: postKeys.all });
    },
  });
}
