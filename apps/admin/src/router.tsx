import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { Placeholder } from "@/app/Placeholder";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PostsListPage } from "@/features/posts/PostsListPage";
import { PostFormPage } from "@/features/posts/PostFormPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/posts", element: <PostsListPage /> },
          { path: "/posts/new", element: <PostFormPage /> },
          { path: "/posts/:slug/edit", element: <PostFormPage /> },
          { path: "/tags", element: <Placeholder title="Tags" /> },
          { path: "/media", element: <Placeholder title="Media" /> },
          { path: "/settings", element: <Placeholder title="Cài đặt" /> },
        ],
      },
    ],
  },
]);
