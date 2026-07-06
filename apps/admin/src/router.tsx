import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { Placeholder } from "@/app/Placeholder";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/posts", element: <Placeholder title="Bài viết" /> },
          { path: "/tags", element: <Placeholder title="Tags" /> },
          { path: "/media", element: <Placeholder title="Media" /> },
          { path: "/settings", element: <Placeholder title="Cài đặt" /> },
        ],
      },
    ],
  },
]);
