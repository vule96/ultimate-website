import next from "eslint-config-next";

// Next 16 bỏ lệnh `next lint` → ESLint flat config trực tiếp.
// eslint-config-next 16 xuất flat config gốc (mảng) — trải thẳng vào đây.
export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "coverage/**",
      "*.config.{js,mjs,ts}",
      "postcss.config.js",
    ],
  },
  ...next,
  {
    // Test mock next/image bằng <img> thuần — không phải render thật (không ship).
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@next/next/no-img-element": "off" },
  },
];
