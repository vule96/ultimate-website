import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/app/Placeholder";

export const Route = createFileRoute("/_authed/tags")({
  component: () => <Placeholder title="Tags" />,
});
