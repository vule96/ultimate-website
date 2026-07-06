import { createContext, useContext } from "react";
import type { AdminUser } from "@ultimate/types";

export type AuthStatus = "loading" | "authenticated" | "guest";

export interface AuthContextValue {
  status: AuthStatus;
  user: AdminUser | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/** Hook đọc trạng thái auth; ném lỗi nếu dùng ngoài AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
