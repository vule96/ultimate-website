import { apiFetch } from "@/lib/apiClient";
import { CORE_URL } from "@/lib/config";
import type { AdminUser } from "@ultimate/types";

/** Lấy admin đang đăng nhập (401 nếu chưa). */
export const fetchMe = () => apiFetch<AdminUser>("/auth/me");

/** Đăng xuất (xoá session server-side). */
export const logout = () => apiFetch<void>("/auth/logout", { method: "POST" });

/** URL bắt đầu OAuth (full-page redirect, không fetch). */
export const googleLoginUrl = `${CORE_URL}/auth/google/login`;
