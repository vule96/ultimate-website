import {
  SubscriberListResponseSchema,
  AdminReaderListResponseSchema,
  type SubscriberListResponse,
  type AdminReaderListResponse,
} from "@ultimate/types";
import { apiFetch } from "@/lib/apiClient";

export interface ListParams {
  page?: number;
  pageSize?: number;
}

function pagingQuery({ page, pageSize }: ListParams): string {
  const sp = new URLSearchParams();
  if (page && page > 0) sp.set("page", String(page));
  if (pageSize && pageSize > 0) sp.set("page_size", String(pageSize));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function listSubscribers(
  params: ListParams = {},
  signal?: AbortSignal,
): Promise<SubscriberListResponse> {
  return apiFetch(
    `/api/v1/subscribers${pagingQuery(params)}`,
    SubscriberListResponseSchema,
    signal ? { signal } : undefined,
  );
}

export function deleteSubscriber(id: string): Promise<void> {
  return apiFetch(`/api/v1/subscribers/${encodeURIComponent(id)}`, null, { method: "DELETE" });
}

export function listReaders(
  params: ListParams = {},
  signal?: AbortSignal,
): Promise<AdminReaderListResponse> {
  return apiFetch(
    `/api/v1/readers${pagingQuery(params)}`,
    AdminReaderListResponseSchema,
    signal ? { signal } : undefined,
  );
}
