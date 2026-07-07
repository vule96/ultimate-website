import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/AppShell";
import { authQueryOptions } from "@/features/auth/api";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions);
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
});
