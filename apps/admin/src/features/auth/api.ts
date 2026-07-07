import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { CORE_URL } from "@/lib/config";
import { AdminUserSchema } from "@ultimate/types";

/** Lấy admin đang đăng nhập (401 nếu chưa); validate response bằng Zod. */
export const fetchMe = () => apiFetch("/auth/me", AdminUserSchema);

/** Query cho admin đang đăng nhập; retry:false để 401 fail nhanh (guard đọc lỗi). */
export const authQueryOptions = queryOptions({
  queryKey: ["auth", "me"] as const,
  queryFn: fetchMe,
  retry: false,
  staleTime: 5 * 60_000,
});

/** Đăng xuất (xoá session server-side); không có nội dung trả về. */
export const logout = () => apiFetch("/auth/logout", null, { method: "POST" });

/** URL bắt đầu OAuth (full-page redirect, không fetch). */
export const googleLoginUrl = `${CORE_URL}/auth/google/login`;
