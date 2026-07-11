import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/AppShell";
import { authQueryOptions } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";
import { savePostLoginRedirect, takePostLoginRedirect } from "@/lib/post-login-redirect";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // location.href = chuỗi path+search; .search là object đã parse (không ghép chuỗi được).
        savePostLoginRedirect(location.href);
        throw redirect({ to: "/login" });
      }
      throw err; // 500/CORS/API sập → error boundary, KHÔNG coi là chưa đăng nhập
    }
    // Vừa đăng nhập xong (quay lại từ OAuth) → nếu có vị trí đã lưu, đưa về đó.
    const back = takePostLoginRedirect();
    if (back && back !== location.href) {
      throw redirect({ to: back });
    }
  },
  component: AppShell,
});
