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
  plugins: [],
};

export default config;
