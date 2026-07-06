import { TagListResponseSchema, type Tag } from "@ultimate/types";
import { apiFetch } from "@/lib/apiClient";

export async function listTags(): Promise<Tag[]> {
  const res = await apiFetch("/api/v1/tags", TagListResponseSchema);
  return res.data;
}
