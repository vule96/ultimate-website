import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { ToastProvider } from "@ultimate/ui";
import { queryClient } from "@/lib/queryClient";
import { setRouter } from "@/lib/router-ref";
import { routeTree } from "./routeTree.gen";
import "@/styles/index.css";

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
});

// Cho queryClient truy cập router để điều hướng khi gặp 401 (session hết hạn).
setRouter(router);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
