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
        surface: "var(--surface)",
        fg: "var(--fg)",
        muted: "var(--muted)",
        line: "var(--line)",
        soft: "var(--soft)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        highlight: "var(--highlight)",
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
        serif: ["Lora", "Georgia", "serif"],
      },
      maxWidth: { prose: "42rem", shell: "1200px" },
      boxShadow: { modal: "var(--shadow-modal)" },
    },
  },
  plugins: [typography],
};

export default config;
