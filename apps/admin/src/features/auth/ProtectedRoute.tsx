import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context";

/** Bọc các route cần đăng nhập. Guest → /login; đang tải → spinner. */
export function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-label="Đang tải">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
