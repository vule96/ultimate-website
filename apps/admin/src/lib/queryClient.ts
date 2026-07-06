import { QueryClient } from "@tanstack/react-query";

/** QueryClient dùng chung cho toàn app admin. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s: tránh refetch dồn dập khi điều hướng qua lại
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
