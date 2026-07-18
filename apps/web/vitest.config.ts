import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // next-intl v4 (ESM) import bare "next/navigation"; pnpm cô lập nên vitest
    // không resolve được từ thư mục next-intl. Inline để vite resolve qua web.
    server: { deps: { inline: ["next-intl"] } },
  },
});
