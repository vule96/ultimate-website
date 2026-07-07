import { createFileRoute } from "@tanstack/react-router";
import { PostFormPage } from "@/features/posts/PostFormPage";
import { postQueryOptions } from "@/features/posts/queries";
import { RouteError, RoutePending } from "@/app/route-states";

export const Route = createFileRoute("/_authed/posts/$slug/edit")({
  loader: ({ context: { queryClient }, params }) =>
    queryClient.ensureQueryData(postQueryOptions(params.slug)),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: EditPost,
});

function EditPost() {
  const { slug } = Route.useParams();
  return <PostFormPage slug={slug} />;
}
