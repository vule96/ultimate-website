import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SubscribersPage } from "@/features/users/SubscribersPage";
import { subscribersQueryOptions } from "@/features/users/queries";
import { PAGE_SIZE } from "@/features/users/shared";
import { RouteError, RoutePending } from "@/app/route-states";

const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  status: z.enum(["active", "unsubscribed"]).optional().catch(undefined),
});

export const Route = createFileRoute("/_authed/subscribers")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(
      subscribersQueryOptions({ page: deps.page, pageSize: PAGE_SIZE, status: deps.status }),
    ),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: SubscribersPage,
});
