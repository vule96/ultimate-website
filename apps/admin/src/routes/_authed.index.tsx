import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import {
  statsQueryOptions,
  timeseriesQueryOptions,
  postsListQueryOptions,
} from "@/features/posts/queries";
import { subscribersQueryOptions, readersQueryOptions } from "@/features/users/queries";
import { RouteError, RoutePending } from "@/app/route-states";

export const Route = createFileRoute("/_authed/")({
  loader: ({ context: { queryClient } }) => {
    const q = queryClient.ensureQueryData.bind(queryClient);
    void q(statsQueryOptions());
    void q(timeseriesQueryOptions(8));
    void q(postsListQueryOptions({ page: 1, pageSize: 6 }));
    void q(postsListQueryOptions({ page: 1, pageSize: 5, sort: "views", order: "desc" }));
    void q(subscribersQueryOptions({ page: 1, pageSize: 5 }));
    void q(readersQueryOptions({ page: 1, pageSize: 1 }));
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: DashboardPage,
});
