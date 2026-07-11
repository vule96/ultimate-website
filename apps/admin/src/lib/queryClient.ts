import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiError } from "./apiClient";
import { getRouter } from "./router-ref";
import { savePostLoginRedirect } from "./post-login-redirect";

// 401 giữa phiên (session hết hạn) → lưu vị trí + xoá cache auth + điều hướng /login.
// - KHÔNG set cache = null (useSuspenseQuery sẽ trả null → user.email crash).
// - removeQueries an toàn (không tạo giá trị null) và buộc login.beforeLoad fetch lại
//   /auth/me → 401 → ở lại login, tránh bounce vòng khi auth còn cached-valid nhưng
//   session đã chết.
function handle401(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    const router = getRouter();
    // location.href là chuỗi path+search sẵn có; KHÔNG dùng .search (là object đã parse → ném lỗi coerce).
    savePostLoginRedirect(router.state.location.href);
    queryClient.removeQueries({ queryKey: ["auth", "me"] });
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
