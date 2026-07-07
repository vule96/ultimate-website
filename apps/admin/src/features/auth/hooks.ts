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
      qc.clear();
      await navigate({ to: "/login" });
    }
  };
}
