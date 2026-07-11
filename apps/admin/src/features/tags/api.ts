import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { TagListResponseSchema, type Tag } from "@ultimate/types";
import { apiFetch } from "@/lib/apiClient";
import { tagKeys } from "./keys";

export async function listTags(): Promise<Tag[]> {
  const res = await apiFetch("/api/v1/tags", TagListResponseSchema);
  return res.data;
}

export const tagsQueryOptions = () =>
  queryOptions({ queryKey: tagKeys.list(), queryFn: listTags });

export const useTagsSuspense = () => useSuspenseQuery(tagsQueryOptions());
