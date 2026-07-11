import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authQueryOptions, logout } from "./api";

/** User đang đăng nhập. Chỉ dùng dưới route _authed (auth đã được guard đảm bảo). */
export function useAuth() {
  const { data: user } = useSuspenseQuery(authQueryOptions);
  return { user };
}

/** Trả về hàm đăng xuất: gọi API, xoá cache, về /login. */
export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    try {
      await logout();
    } finally {
      // Navigate trước, clear cache sau — tránh observer _authed refetch → 401 flash
      // đua với điều hướng (A9).
      await navigate({ to: "/login" });
      qc.clear();
    }
  };
}
