import type { Config } from "tailwindcss";
import { uiPreset } from "@ultimate/ui/tailwind.preset";
import typography from "@tailwindcss/typography";

const config: Config = {
  presets: [uiPreset as Partial<Config>],
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        page: "var(--page)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        soft: "var(--soft)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        brand: "var(--brand)",
        "brand-ink": "var(--brand-ink)",
        "brand-tint": "var(--brand-tint)",
        "sec-tech": "var(--sec-tech)",
        "sec-fin": "var(--sec-fin)",
        "sec-life": "var(--sec-life)",
        "sec-cul": "var(--sec-cul)",
        "sec-dev": "var(--sec-dev)",
        "sec-book": "var(--sec-book)",
        "chrome-bg": "var(--chrome-bg)",
        "chrome-fg": "var(--chrome-fg)",
        "chrome-muted": "var(--chrome-muted)",
        "chrome-line": "var(--chrome-line)",
        ink: "var(--ink)",
        "ink-fg": "var(--ink-fg)",
        "ink-muted": "var(--ink-muted)",
        "field-bg": "var(--field-bg)",
        "field-fg": "var(--field-fg)",
        "field-ring": "var(--field-ring)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        serif: ["var(--font-serif)"],
      },
      maxWidth: { prose: "42rem", shell: "1200px" },
      boxShadow: { modal: "var(--shadow-modal)" },
    },
  },
  plugins: [typography],
};

export default config;
