import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/app/Placeholder";

export const Route = createFileRoute("/_authed/settings")({
  component: () => <Placeholder title="Cài đặt" />,
});
