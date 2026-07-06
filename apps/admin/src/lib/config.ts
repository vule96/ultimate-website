/** URL của Go core API. Đổi qua VITE_CORE_URL khi build/deploy. */
export const CORE_URL: string =
  import.meta.env.VITE_CORE_URL ?? "http://localhost:8080";
