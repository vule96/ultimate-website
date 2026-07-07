import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/app/Placeholder";

export const Route = createFileRoute("/_authed/media")({
  component: () => <Placeholder title="Media" />,
});
