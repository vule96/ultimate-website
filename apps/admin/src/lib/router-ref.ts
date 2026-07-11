// Giữ tham chiếu router để queryClient (tạo trước router) điều hướng khi gặp 401.
// Tránh circular import: queryClient import module này, main.tsx gọi setRouter sau
// khi createRouter.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let router: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setRouter(r: any): void {
  router = r;
}

export function getRouter() {
  if (!router) throw new Error("router chưa được set (gọi setRouter trong main.tsx)");
  return router;
}
