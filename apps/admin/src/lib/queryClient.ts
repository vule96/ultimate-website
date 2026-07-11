import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiError } from "./apiClient";
import { getRouter } from "./router-ref";
import { savePostLoginRedirect } from "./post-login-redirect";

// 401 giữa phiên (session hết hạn) → lưu vị trí hiện tại + điều hướng về /login.
function handle401(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    const router = getRouter();
    queryClient.setQueryData(["auth", "me"], null);
    savePostLoginRedirect(router.state.location.pathname + router.state.location.search);
    void router.navigate({ to: "/login" });
  }
}

/** QueryClient dùng chung cho toàn app admin. */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handle401 }),
  mutationCache: new MutationCache({ onError: handle401 }),
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s: tránh refetch dồn dập khi điều hướng qua lại
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
