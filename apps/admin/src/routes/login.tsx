import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/LoginPage";
import { authQueryOptions } from "@/features/auth/api";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions);
    } catch {
      return; // chưa đăng nhập → ở lại trang login
    }
    throw redirect({ to: "/" }); // đã đăng nhập → vào dashboard
  },
  component: LoginPage,
});
