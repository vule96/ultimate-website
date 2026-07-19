import type { Config } from "tailwindcss";
import { uiPreset } from "@ultimate/ui/tailwind.preset";

const config: Config = {
  presets: [uiPreset as Partial<Config>],
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Bản sắc admin: Plus Jakarta Sans (humanist) + JetBrains Mono (data).
        sans: ['"Plus Jakarta Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
