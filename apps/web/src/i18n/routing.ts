import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

/** Type guard: chuỗi bất kỳ (param URL) có phải locale hợp lệ. */
export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && routing.locales.includes(value as Locale);
}
