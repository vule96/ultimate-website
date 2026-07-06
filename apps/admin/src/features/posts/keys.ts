import type { ListPostsParams } from "./api";

/** Query keys tập trung cho module posts — tránh gõ chuỗi rải rác. */
export const postKeys = {
  all: ["posts"] as const,
  lists: () => [...postKeys.all, "list"] as const,
  list: (params: ListPostsParams) => [...postKeys.lists(), params] as const,
  details: () => [...postKeys.all, "detail"] as const,
  detail: (slug: string) => [...postKeys.details(), slug] as const,
  stats: () => [...postKeys.all, "stats"] as const,
};

export const tagKeys = {
  all: ["tags"] as const,
  list: () => [...tagKeys.all, "list"] as const,
};
