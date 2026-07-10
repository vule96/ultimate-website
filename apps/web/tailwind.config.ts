import type { Config } from "tailwindcss";
import { uiPreset } from "@ultimate/ui/tailwind.preset";
import typography from "@tailwindcss/typography";

const config: Config = {
  presets: [uiPreset as Partial<Config>],
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [typography],
};

export default config;
