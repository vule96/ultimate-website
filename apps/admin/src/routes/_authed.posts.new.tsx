import { createFileRoute } from "@tanstack/react-router";
import { PostFormPage } from "@/features/posts/PostFormPage";

export const Route = createFileRoute("/_authed/posts/new")({
  component: () => <PostFormPage />,
});
