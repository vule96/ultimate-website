import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { TagListResponseSchema, type Tag } from "@ultimate/types";
import { apiFetch } from "@/lib/apiClient";

export async function listTags(): Promise<Tag[]> {
  const res = await apiFetch("/api/v1/tags", TagListResponseSchema);
  return res.data;
}

export const tagsQueryOptions = () =>
  queryOptions({ queryKey: ["tags", "list"] as const, queryFn: listTags });

export const useTagsSuspense = () => useSuspenseQuery(tagsQueryOptions());
