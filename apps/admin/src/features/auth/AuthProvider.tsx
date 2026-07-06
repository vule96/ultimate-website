import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AdminUser } from "@ultimate/types";
import { AuthContext, type AuthStatus } from "./context";
import { fetchMe, logout } from "./api";

/** Cung cấp trạng thái auth cho app; kiểm tra /auth/me khi mount. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AdminUser | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setStatus("guest");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ status, user, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
