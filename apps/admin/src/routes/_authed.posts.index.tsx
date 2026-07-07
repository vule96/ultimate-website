import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PostSortFieldSchema, SortOrderSchema } from "@ultimate/types";
import { PostsListPage } from "@/features/posts/PostsListPage";
import { postsListQueryOptions } from "@/features/posts/queries";
import { tagsQueryOptions } from "@/features/tags/api";
import { RouteError, RoutePending } from "@/app/route-states";

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "PUBLISHED"]).or(z.literal("")).default("").catch(""),
  tag: z.string().default("").catch(""),
  q: z.string().default("").catch(""),
  sort: PostSortFieldSchema.default("created_at").catch("created_at"),
  order: SortOrderSchema.default("desc").catch("desc"),
});

const PAGE_SIZE = 10;

export const Route = createFileRoute("/_authed/posts/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient.ensureQueryData(tagsQueryOptions());
    return queryClient.ensureQueryData(
      postsListQueryOptions({
        page: deps.page,
        pageSize: PAGE_SIZE,
        status: deps.status,
        tag: deps.tag,
        q: deps.q,
        sort: deps.sort,
        order: deps.order,
      }),
    );
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: PostsListPage,
});
