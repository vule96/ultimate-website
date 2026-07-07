import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import {
  statsQueryOptions,
  timeseriesQueryOptions,
  postsListQueryOptions,
} from "@/features/posts/queries";
import { RouteError, RoutePending } from "@/app/route-states";

export const Route = createFileRoute("/_authed/")({
  loader: ({ context: { queryClient } }) => {
    void queryClient.ensureQueryData(statsQueryOptions());
    void queryClient.ensureQueryData(timeseriesQueryOptions(8));
    void queryClient.ensureQueryData(postsListQueryOptions({ page: 1, pageSize: 5 }));
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: DashboardPage,
});
