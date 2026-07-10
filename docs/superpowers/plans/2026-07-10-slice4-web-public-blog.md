# Slice 4 — `apps/web` blog công khai + `packages/ui` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng blog công khai `apps/web` (Next.js App Router, SSG+ISR, SEO) đọc dữ liệu thật từ Go core, và tách `packages/ui` dùng chung — migrate `admin` sang dùng.

**Architecture:** Monorepo pnpm + Turbo. `@ultimate/ui` chứa shadcn primitives + `cn` + theme (Tailwind preset + CSS vars), dùng cho cả `web` (Next RSC) và `admin` (Vite SPA). `apps/web` fetch phía server (RSC) từ `${CORE_API_URL}/api/v1`, validate bằng schema Zod `@ultimate/types`, ép `status=PUBLISHED`, render tĩnh + ISR.

**Tech Stack:** Next.js 14.2 (App Router, React 18), Tailwind v3, `@tailwindcss/typography`, Vitest, `@ultimate/ui`, `@ultimate/types` (Zod v4).

## Global Constraints

- React **18** (`^18.3.1`) ở web + admin + peer của `@ultimate/ui` (không dùng React 19).
- Tailwind **v3** (`^3.4.17`) cả hai app; theme chung 1 nguồn qua `@ultimate/ui/tailwind.preset`.
- Next.js **14.2.x** (dùng `next.config.mjs`, KHÔNG `next.config.ts` vốn là Next 15+).
- API base công khai: `${CORE_API_URL}/api/v1` — routes `/posts`, `/posts/:slug`, `/tags` (đã xác nhận `main.go:85`). Public GET, không auth.
- **Luôn** gửi `status=PUBLISHED` cho list; chi tiết non-PUBLISHED → `notFound()`.
- Mọi field API là **snake_case** (`content_html`, `cover_image`, `published_at`, `meta_title`, `meta_desc`, `page_size`). Nullable: `excerpt`, `cover_image`, `meta_title`, `meta_desc`, `published_at`.
- `CORE_API_URL` **không** prefix `NEXT_PUBLIC_` (chỉ dùng server-side). `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MEDIA_HOST` là client-safe.
- Tên blog / `SITE_NAME` = **"Ultimate website"**; route bài = `/blog/[slug]`; `PAGE_SIZE=10`; `REVALIDATE=60`.
- Không đổi backend (không migration DB). Không tạo `packages/api-client`.
- Nhánh: `slice-4-web-public-blog`. Commit thường xuyên (mỗi task ≥1 commit).

---

## File Structure

**`packages/ui/`** (mới)
- `package.json`, `tsconfig.json`, `vitest.config.ts` — khai báo package + test.
- `tailwind.preset.ts` — theme HiveQ (colors/radius/font/shadow).
- `src/styles/theme.css` — CSS vars `:root`/`.dark` (plain CSS).
- `src/lib/cn.ts` (+ `cn.test.ts`) — util gộp class.
- `src/components/*.tsx` — 11 shadcn primitives (chuyển từ admin).
- `src/components/index.ts`, `src/index.ts` — barrel export.

**`apps/admin/`** (sửa)
- `package.json` — thêm `@ultimate/ui`.
- `tailwind.config.ts` — `presets:[uiPreset]` + content gồm packages/ui.
- `src/styles/index.css` — `@import` theme.css thay block vars inline.
- ~15 file app + `data-table.tsx` — đổi import sang `@ultimate/ui`.
- Xoá: `src/components/ui/{11 primitives}.tsx`, `src/lib/cn.ts`.

**`apps/web/`** (mới)
- Config: `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`, `.env.example`.
- `src/lib/config.ts` — hằng số môi trường.
- `src/features/posts/api.ts` (+ `api.test.ts`) — data layer.
- `src/features/posts/pagination-utils.ts` (+ test) — helper phân trang.
- `src/features/posts/metadata.ts` (+ test) — builder SEO metadata.
- `src/features/posts/rss.ts` (+ test) — builder RSS XML.
- `src/features/posts/components/{post-card,post-list,pagination,post-content,tag-badge}.tsx`.
- `src/components/{site-header,site-footer}.tsx`.
- `src/app/{layout,page,globals.css}` + `blog/[slug]/page.tsx` + `tags/page.tsx` + `tags/[slug]/page.tsx` + `sitemap.ts` + `robots.ts` + `rss.xml/route.ts`.

---

## Task 1: Scaffold `packages/ui` + `cn` (TDD)

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/vitest.config.ts`
- Create: `packages/ui/tailwind.preset.ts`, `packages/ui/src/styles/theme.css`
- Create: `packages/ui/src/lib/cn.ts`, `packages/ui/src/index.ts`, `packages/ui/src/components/index.ts`
- Test: `packages/ui/src/lib/cn.test.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string`; `uiPreset` (default + named export); barrel `@ultimate/ui`.

- [ ] **Step 1: Tạo `packages/ui/package.json`**

```json
{
  "name": "@ultimate/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles/theme.css": "./src/styles/theme.css",
    "./tailwind.preset": "./tailwind.preset.ts"
  },
  "scripts": {
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": { "react": "^18", "react-dom": "^18" },
  "dependencies": {
    "@radix-ui/react-alert-dialog": "^1.1.18",
    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.19",
    "@radix-ui/react-select": "^2.3.2",
    "@radix-ui/react-slot": "^1.1.1",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.469.0",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Tạo `packages/ui/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tailwind.preset.ts"]
}
```

- [ ] **Step 3: Tạo `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", globals: true },
});
```

- [ ] **Step 4: Tạo `packages/ui/tailwind.preset.ts`**

```ts
import type { Config } from "tailwindcss";

/** Preset theme HiveQ dùng chung cho web + admin. */
export const uiPreset = {
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        chip: {
          green: "hsl(142 72% 42%)",
          blue: "hsl(217 91% 60%)",
          orange: "hsl(38 92% 50%)",
          violet: "hsl(258 90% 66%)",
        },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 4px)", sm: "calc(var(--radius) - 8px)" },
      boxShadow: { card: "0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.04)" },
    },
  },
} satisfies Partial<Config>;

export default uiPreset;
```

- [ ] **Step 5: Tạo `packages/ui/src/styles/theme.css`** (plain CSS, không `@tailwind`/`@apply`)

```css
:root {
  --background: 220 20% 98%;
  --foreground: 210 9% 11%;
  --card: 0 0% 100%;
  --card-foreground: 210 9% 11%;
  --primary: 142 72% 36%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 16% 96%;
  --secondary-foreground: 210 9% 11%;
  --muted: 220 16% 96%;
  --muted-foreground: 220 9% 46%;
  --accent: 142 72% 95%;
  --accent-foreground: 142 72% 26%;
  --border: 220 16% 92%;
  --input: 220 16% 92%;
  --ring: 142 72% 36%;
  --radius: 1rem;
}
.dark {
  --background: 222 18% 8%;
  --foreground: 210 17% 92%;
  --card: 222 16% 11%;
  --card-foreground: 210 17% 92%;
  --primary: 142 66% 45%;
  --primary-foreground: 222 18% 8%;
  --secondary: 222 14% 16%;
  --secondary-foreground: 210 17% 92%;
  --muted: 222 14% 16%;
  --muted-foreground: 220 9% 60%;
  --accent: 142 40% 18%;
  --accent-foreground: 142 66% 75%;
  --border: 222 14% 18%;
  --input: 222 14% 18%;
  --ring: 142 66% 45%;
}
```

- [ ] **Step 6: Tạo `packages/ui/src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp class Tailwind, xử lý xung đột (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Viết test thất bại `packages/ui/src/lib/cn.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("gộp nhiều class", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("giải xung đột tailwind (class sau thắng)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("bỏ giá trị falsy", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
```

- [ ] **Step 8: Tạo barrel tạm `packages/ui/src/components/index.ts`** (rỗng, điền ở Task 2)

```ts
// Các primitive được export ở Task 2.
export {};
```

- [ ] **Step 9: Tạo `packages/ui/src/index.ts`**

```ts
export { cn } from "./lib/cn";
export * from "./components";
```

- [ ] **Step 10: Cài deps + chạy test**

Run: `pnpm install && pnpm --filter @ultimate/ui test`
Expected: PASS (3 test của `cn`).

- [ ] **Step 11: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): scaffold @ultimate/ui (cn + theme preset + theme.css)"
```

---

## Task 2: Chuyển shadcn primitives vào `packages/ui`

**Files:**
- Move: `apps/admin/src/components/ui/{button,card,badge,input,label,select,textarea,avatar,alert-dialog,dropdown-menu,toast}.tsx` → `packages/ui/src/components/`
- Modify: mỗi file chuyển — sửa import nội bộ; thêm `"use client"` cho component Radix/hook.
- Modify: `packages/ui/src/components/index.ts` — barrel export.

**Interfaces:**
- Produces: named exports `Button, buttonVariants, Card (+CardHeader/Title/…), Badge, Input, Label, Select (+…), Textarea, Avatar (+…), AlertDialog (+…), DropdownMenu (+…), Toast/Toaster/useToast` (giữ nguyên tên hiện có ở admin).

- [ ] **Step 1: Di chuyển 11 file primitive**

```bash
cd /c/Projects/ultimate-website
git mv apps/admin/src/components/ui/button.tsx        packages/ui/src/components/button.tsx
git mv apps/admin/src/components/ui/card.tsx          packages/ui/src/components/card.tsx
git mv apps/admin/src/components/ui/badge.tsx         packages/ui/src/components/badge.tsx
git mv apps/admin/src/components/ui/input.tsx         packages/ui/src/components/input.tsx
git mv apps/admin/src/components/ui/label.tsx         packages/ui/src/components/label.tsx
git mv apps/admin/src/components/ui/select.tsx        packages/ui/src/components/select.tsx
git mv apps/admin/src/components/ui/textarea.tsx      packages/ui/src/components/textarea.tsx
git mv apps/admin/src/components/ui/avatar.tsx        packages/ui/src/components/avatar.tsx
git mv apps/admin/src/components/ui/alert-dialog.tsx  packages/ui/src/components/alert-dialog.tsx
git mv apps/admin/src/components/ui/dropdown-menu.tsx packages/ui/src/components/dropdown-menu.tsx
git mv apps/admin/src/components/ui/toast.tsx         packages/ui/src/components/toast.tsx
```

- [ ] **Step 2: Sửa import `cn` trong mọi file vừa chuyển**

Trong `packages/ui/src/components/*.tsx`, đổi:
- `import { cn } from "@/lib/cn";` → `import { cn } from "../lib/cn";`
- Nếu file nào import primitive khác qua `@/components/ui/<x>` → đổi thành `./<x>`.

Chạy để kiểm tra còn sót:
Run: `grep -rn "@/lib/cn\|@/components/ui" packages/ui/src`
Expected: không còn dòng nào.

- [ ] **Step 3: Thêm `"use client"` cho component tương tác**

Thêm dòng đầu tiên `"use client";` (kèm dòng trống) vào các file dùng Radix/hook:
`alert-dialog.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, `select.tsx`, `toast.tsx`.
(Không thêm cho `button/card/badge/input/label/textarea` — để dùng được trong RSC.)

- [ ] **Step 4: Điền barrel `packages/ui/src/components/index.ts`**

```ts
export * from "./button";
export * from "./card";
export * from "./badge";
export * from "./input";
export * from "./label";
export * from "./select";
export * from "./textarea";
export * from "./avatar";
export * from "./alert-dialog";
export * from "./dropdown-menu";
export * from "./toast";
```

- [ ] **Step 5: Typecheck package**

Run: `pnpm --filter @ultimate/ui lint`
Expected: PASS (không lỗi TS). Nếu báo thiếu type React → đảm bảo `@types/react` đã cài (Task 1 devDeps) và chạy lại `pnpm install`.

- [ ] **Step 6: Commit**

```bash
git add packages/ui apps/admin
git commit -m "refactor(ui): chuyển shadcn primitives vào @ultimate/ui (+use client cho Radix)"
```

---

## Task 3: Migrate `admin` sang `@ultimate/ui` + chia sẻ theme

**Files:**
- Modify: `apps/admin/package.json` — thêm dependency.
- Modify: `apps/admin/tailwind.config.ts` — dùng preset + content packages/ui.
- Modify: `apps/admin/src/styles/index.css` — `@import` theme.css, bỏ block vars.
- Modify: ~15 file app + `apps/admin/src/components/ui/data-table.tsx` — đổi import.
- Delete: `apps/admin/src/lib/cn.ts`.

**Interfaces:**
- Consumes: barrel `@ultimate/ui` (Task 1–2).

- [ ] **Step 1: Thêm dependency vào `apps/admin/package.json`**

Thêm vào `"dependencies"`: `"@ultimate/ui": "workspace:*",` (giữ thứ tự alphabet gần `@ultimate/types`). Rồi:
Run: `pnpm install`

- [ ] **Step 2: Đổi import primitive đã chuyển → `@ultimate/ui`**

Chạy codemod (chỉ đổi 11 path đã chuyển; `data-table` GIỮ nguyên path vì còn ở admin):

```bash
cd /c/Projects/ultimate-website/apps/admin
FILES=$(grep -rl -E "@/components/ui/(button|card|badge|input|label|select|textarea|avatar|alert-dialog|dropdown-menu|toast)|@/lib/cn" src --include=*.ts --include=*.tsx)
for f in $FILES; do
  sed -i -E 's#@/components/ui/(button|card|badge|input|label|select|textarea|avatar|alert-dialog|dropdown-menu|toast)#@ultimate/ui#g; s#@/lib/cn#@ultimate/ui#g' "$f"
done
```

- [ ] **Step 3: Xoá `cn.ts` cũ**

```bash
git rm apps/admin/src/lib/cn.ts
```

- [ ] **Step 4: Kiểm tra không còn import cũ (trừ data-table path)**

Run: `grep -rn "@/lib/cn" apps/admin/src; grep -rnE "@/components/ui/(button|card|badge|input|label|select|textarea|avatar|alert-dialog|dropdown-menu|toast)\b" apps/admin/src`
Expected: rỗng cả hai.

- [ ] **Step 5: Cập nhật `apps/admin/tailwind.config.ts`**

Thay toàn bộ nội dung bằng (dùng preset chung, thêm content packages/ui):

```ts
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
```

- [ ] **Step 6: Cập nhật `apps/admin/src/styles/index.css`**

Thay 4 dòng `@import @fontsource` + block `:root`/`.dark` bằng: giữ font imports, thêm `@import "@ultimate/ui/styles/theme.css";`, **xoá** hai block `:root {…}` và `.dark {…}` (đã chuyển sang theme.css), GIỮ phần `@layer base { * {…} body {…} }`:

```css
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";
@import "@ultimate/ui/styles/theme.css";

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

- [ ] **Step 7: Chạy test admin (regression)**

Run: `pnpm --filter @ultimate/admin test`
Expected: PASS — toàn bộ test hiện có (gồm `data-table.test.tsx`, `apiClient.test.ts`) xanh.

- [ ] **Step 8: Build admin**

Run: `pnpm --filter @ultimate/admin build`
Expected: `tsc --noEmit` + `vite build` thành công, không lỗi import.

- [ ] **Step 9: Smoke UI admin (thủ công/Playwright)**

Run: `pnpm --filter @ultimate/admin dev` → mở `http://localhost:5173`.
Kỳ vọng: giao diện (màu emerald, card bo góc, sidebar) **không đổi**; trang login/dashboard/posts table/form render đúng như trước.

- [ ] **Step 10: Commit**

```bash
git add apps/admin pnpm-lock.yaml
git commit -m "refactor(admin): dùng @ultimate/ui + theme preset chung (không đổi hành vi/UI)"
```

---

## Task 4: Scaffold `apps/web` (Next.js) + layout gốc

**Files:**
- Create: `apps/web/package.json`, `next.config.mjs`, `tsconfig.json`, `next-env.d.ts`, `tailwind.config.ts`, `postcss.config.js`, `.env.example`, `.gitignore`
- Create: `src/lib/config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (placeholder), `src/components/site-header.tsx`, `src/components/site-footer.tsx`

**Interfaces:**
- Produces: hằng số trong `config.ts`: `CORE_API_URL`, `API_BASE`, `SITE_URL`, `SITE_NAME`, `REVALIDATE`, `PAGE_SIZE`.

- [ ] **Step 1: Tạo `apps/web/package.json`**

```json
{
  "name": "@ultimate/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource/inter": "^5.1.0",
    "@ultimate/types": "workspace:*",
    "@ultimate/ui": "workspace:*",
    "next": "^14.2.15",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.15",
    "@types/node": "^22.10.0",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Tạo `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ultimate/ui", "@ultimate/types"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: process.env.NEXT_PUBLIC_MEDIA_HOST ?? "localhost" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 3: Tạo `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Tạo `apps/web/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: Tạo `apps/web/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Tạo `apps/web/tailwind.config.ts`**

```ts
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
```

- [ ] **Step 7: Tạo `apps/web/src/app/globals.css`**

```css
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/inter/700.css";
@import "@ultimate/ui/styles/theme.css";

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
}
```

> Nếu Next báo không resolve được `@import "@ultimate/ui/styles/theme.css"`, thay bằng đường dẫn tương đối `@import "../../../../packages/ui/src/styles/theme.css";`.

- [ ] **Step 8: Tạo `apps/web/src/lib/config.ts`**

```ts
/** Base URL core (server-only). Không prefix NEXT_PUBLIC → không lộ ra client. */
export const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:8080";
export const API_BASE = `${CORE_API_URL}/api/v1`;

/** URL site công khai (client-safe) — dùng cho canonical/sitemap/rss/OG. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "Ultimate website";

export const REVALIDATE = 60;
export const PAGE_SIZE = 10;
```

- [ ] **Step 9: Tạo `apps/web/src/components/site-header.tsx`**

```tsx
import Link from "next/link";
import { SITE_NAME } from "@/lib/config";

export function SiteHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold">{SITE_NAME}</Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          <Link href="/">Bài viết</Link>
          <Link href="/tags">Tags</Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 10: Tạo `apps/web/src/components/site-footer.tsx`**

```tsx
import { SITE_NAME } from "@/lib/config";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-card">
      <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-muted-foreground">
        © {SITE_NAME}
      </div>
    </footer>
  );
}
```

- [ ] **Step 11: Tạo `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Blog cá nhân — Ultimate website.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
```

- [ ] **Step 12: Tạo `apps/web/src/app/page.tsx`** (placeholder, thay ở Task 6)

```tsx
export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Ultimate website</h1>
      <p className="mt-4 text-muted-foreground">Blog đang được dựng…</p>
    </main>
  );
}
```

- [ ] **Step 13: Tạo `apps/web/.env.example`**

```
CORE_API_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_HOST=localhost
```

- [ ] **Step 14: Tạo `apps/web/.gitignore`**

```
.next/
next-env.d.ts
```

> `next-env.d.ts` đã tạo tay ở Step 4 để typecheck; Next sẽ tự tái tạo. Ignore để tránh nhiễu diff.

- [ ] **Step 15: Cài + build thử**

Run: `pnpm install && pnpm --filter @ultimate/web build`
Expected: Next build thành công, sinh route `/` tĩnh. Nếu lỗi CSS `@import` → áp dụng fallback ở Step 7.

- [ ] **Step 16: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js app (layout, theme dùng @ultimate/ui, config)"
```

---

## Task 5: Data layer `features/posts/api.ts` (TDD)

**Files:**
- Create: `apps/web/src/features/posts/api.ts`
- Create: `apps/web/vitest.config.ts`
- Test: `apps/web/src/features/posts/api.test.ts`

**Interfaces:**
- Consumes: `API_BASE`, `PAGE_SIZE`, `REVALIDATE` (Task 4); schema `@ultimate/types`.
- Produces:
  - `buildPublishedQuery(params: { page?: number; tag?: string }): string`
  - `listPublished(params?): Promise<PostListResponse>`
  - `getPublishedBySlug(slug: string): Promise<Post | null>`
  - `listTags(): Promise<Tag[]>`
  - `listAllPublished(): Promise<Post[]>`

- [ ] **Step 1: Tạo `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "node", globals: true },
});
```

- [ ] **Step 2: Viết test thất bại `apps/web/src/features/posts/api.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPublishedQuery, getPublishedBySlug, listPublished } from "./api";

const basePost = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Xin chào",
  slug: "xin-chao",
  content_json: {},
  content_html: "<p>hi</p>",
  excerpt: "tóm tắt",
  cover_image: null,
  status: "PUBLISHED",
  meta_title: null,
  meta_desc: null,
  published_at: "2026-07-01T00:00:00Z",
  tags: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("buildPublishedQuery", () => {
  it("luôn gắn status=PUBLISHED và page_size", () => {
    const q = buildPublishedQuery({});
    expect(q).toContain("status=PUBLISHED");
    expect(q).toContain("page_size=10");
  });
  it("thêm tag khi có", () => {
    expect(buildPublishedQuery({ tag: "go" })).toContain("tag=go");
  });
});

describe("listPublished", () => {
  it("gọi fetch với status=PUBLISHED", async () => {
    const fn = stubFetch(200, { data: [basePost], page: 1, page_size: 10, total: 1 });
    const res = await listPublished({ page: 2 });
    expect(res.total).toBe(1);
    expect(String(fn.mock.calls[0][0])).toContain("status=PUBLISHED");
    expect(String(fn.mock.calls[0][0])).toContain("page=2");
  });
});

describe("getPublishedBySlug", () => {
  it("trả post khi PUBLISHED", async () => {
    stubFetch(200, basePost);
    const p = await getPublishedBySlug("xin-chao");
    expect(p?.slug).toBe("xin-chao");
  });
  it("trả null khi DRAFT (chống lộ bài nháp)", async () => {
    stubFetch(200, { ...basePost, status: "DRAFT" });
    expect(await getPublishedBySlug("xin-chao")).toBeNull();
  });
  it("trả null khi core 404", async () => {
    stubFetch(404, { error: { code: "NOT_FOUND", message: "x" } });
    expect(await getPublishedBySlug("khong-co")).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy test để thấy fail**

Run: `pnpm --filter @ultimate/web test`
Expected: FAIL ("Cannot find module './api'" hoặc export chưa có).

- [ ] **Step 4: Viết `apps/web/src/features/posts/api.ts`**

```ts
import {
  PostSchema,
  PostListResponseSchema,
  TagListResponseSchema,
  type Post,
  type PostListResponse,
  type Tag,
} from "@ultimate/types";
import { API_BASE, PAGE_SIZE, REVALIDATE } from "@/lib/config";

export interface ListPublishedParams {
  page?: number;
  tag?: string;
}

/** Query công khai — LUÔN ép status=PUBLISHED. */
export function buildPublishedQuery(params: ListPublishedParams): string {
  const sp = new URLSearchParams();
  sp.set("status", "PUBLISHED");
  sp.set("page_size", String(PAGE_SIZE));
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.tag) sp.set("tag", params.tag);
  return `?${sp.toString()}`;
}

const fetchOpts = { next: { revalidate: REVALIDATE } } as const;

export async function listPublished(params: ListPublishedParams = {}): Promise<PostListResponse> {
  const res = await fetch(`${API_BASE}/posts${buildPublishedQuery(params)}`, fetchOpts);
  if (!res.ok) throw new Error(`listPublished failed: ${res.status}`);
  return PostListResponseSchema.parse(await res.json());
}

export async function getPublishedBySlug(slug: string): Promise<Post | null> {
  const res = await fetch(`${API_BASE}/posts/${encodeURIComponent(slug)}`, fetchOpts);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getPublishedBySlug failed: ${res.status}`);
  const post = PostSchema.parse(await res.json());
  return post.status === "PUBLISHED" ? post : null;
}

export async function listTags(): Promise<Tag[]> {
  const res = await fetch(`${API_BASE}/tags`, fetchOpts);
  if (!res.ok) throw new Error(`listTags failed: ${res.status}`);
  return TagListResponseSchema.parse(await res.json()).data;
}

/** Gom toàn bộ bài PUBLISHED (lặp hết trang) — cho sitemap/rss/generateStaticParams. */
export async function listAllPublished(): Promise<Post[]> {
  const all: Post[] = [];
  let page = 1;
  for (;;) {
    const { data, total, page_size } = await listPublished({ page });
    all.push(...data);
    if (data.length === 0 || page * page_size >= total) break;
    page++;
  }
  return all;
}
```

- [ ] **Step 5: Chạy test để pass**

Run: `pnpm --filter @ultimate/web test`
Expected: PASS (tất cả test của `api.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): data layer posts (ép PUBLISHED, notFound draft, Zod parse) + test"
```

---

## Task 6: Trang chủ — danh sách bài + phân trang (TDD helper)

**Files:**
- Create: `apps/web/src/features/posts/pagination-utils.ts`
- Test: `apps/web/src/features/posts/pagination-utils.test.ts`
- Create: `apps/web/src/features/posts/components/{tag-badge,post-card,post-list,pagination}.tsx`
- Modify: `apps/web/src/app/page.tsx`

**Interfaces:**
- Produces: `totalPages(total, pageSize): number`; `pageHref(basePath, page): string`; component `PostCard`, `PostList`, `Pagination`, `TagBadge`.
- Consumes: `listPublished`, `PAGE_SIZE`.

- [ ] **Step 1: Viết test thất bại `pagination-utils.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { totalPages, pageHref } from "./pagination-utils";

describe("totalPages", () => {
  it("tối thiểu 1 trang khi rỗng", () => expect(totalPages(0, 10)).toBe(1));
  it("làm tròn lên", () => expect(totalPages(25, 10)).toBe(3));
  it("khớp bội số", () => expect(totalPages(20, 10)).toBe(2));
});

describe("pageHref", () => {
  it("trang 1 = basePath (không query)", () => expect(pageHref("/", 1)).toBe("/"));
  it("trang >1 thêm ?page", () => expect(pageHref("/", 2)).toBe("/?page=2"));
  it("giữ basePath phức tạp", () => expect(pageHref("/tags/go", 3)).toBe("/tags/go?page=3"));
});
```

- [ ] **Step 2: Chạy test để fail**

Run: `pnpm --filter @ultimate/web test pagination-utils`
Expected: FAIL (module chưa có).

- [ ] **Step 3: Viết `pagination-utils.ts`**

```ts
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function pageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}
```

- [ ] **Step 4: Chạy test để pass**

Run: `pnpm --filter @ultimate/web test pagination-utils`
Expected: PASS.

- [ ] **Step 5: Viết `components/tag-badge.tsx`**

```tsx
import Link from "next/link";
import type { Tag } from "@ultimate/types";
import { Badge } from "@ultimate/ui";

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <Link href={`/tags/${tag.slug}`}>
      <Badge>{tag.name}</Badge>
    </Link>
  );
}
```

- [ ] **Step 6: Viết `components/post-card.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import type { Post } from "@ultimate/types";
import { Card } from "@ultimate/ui";
import { TagBadge } from "./tag-badge";

export function PostCard({ post }: { post: Post }) {
  return (
    <Card className="overflow-hidden">
      <Link href={`/blog/${post.slug}`} className="block">
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt={post.title}
            width={800}
            height={420}
            className="h-48 w-full object-cover"
          />
        ) : null}
        <div className="p-5">
          <h2 className="text-xl font-semibold">{post.title}</h2>
          {post.excerpt ? (
            <p className="mt-2 text-muted-foreground">{post.excerpt}</p>
          ) : null}
        </div>
      </Link>
      {post.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {post.tags.map((t) => (
            <TagBadge key={t.slug} tag={t} />
          ))}
        </div>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 7: Viết `components/post-list.tsx`**

```tsx
import type { Post } from "@ultimate/types";
import { PostCard } from "./post-card";

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return <p className="text-muted-foreground">Chưa có bài viết nào.</p>;
  }
  return (
    <div className="grid gap-6">
      {posts.map((p) => (
        <PostCard key={p.slug} post={p} />
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Viết `components/pagination.tsx`**

```tsx
import Link from "next/link";
import { pageHref } from "../pagination-utils";

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-between">
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1)} className="underline">← Trước</Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">Trang {page}/{totalPages}</span>
      {page < totalPages ? (
        <Link href={pageHref(basePath, page + 1)} className="underline">Sau →</Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
```

- [ ] **Step 9: Thay `apps/web/src/app/page.tsx`**

```tsx
import { listPublished } from "@/features/posts/api";
import { PostList } from "@/features/posts/components/post-list";
import { Pagination } from "@/features/posts/components/pagination";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { data, total } = await listPublished({ page });
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">Bài viết mới nhất</h1>
      <PostList posts={data} />
      <Pagination page={page} totalPages={totalPages(total, PAGE_SIZE)} basePath="/" />
    </main>
  );
}
```

- [ ] **Step 10: Build kiểm tra**

Run: `pnpm --filter @ultimate/web build`
Expected: build OK (route `/` là dynamic vì đọc searchParams — chấp nhận).

- [ ] **Step 11: Commit**

```bash
git add apps/web
git commit -m "feat(web): trang chủ danh sách bài PUBLISHED + phân trang (+test helper)"
```

---

## Task 7: Trang chi tiết `/blog/[slug]` + generateStaticParams + notFound

**Files:**
- Create: `apps/web/src/features/posts/components/post-content.tsx`
- Create: `apps/web/src/app/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getPublishedBySlug`, `listAllPublished` (Task 5); `PostContent`, `TagBadge`.

- [ ] **Step 1: Viết `components/post-content.tsx`**

```tsx
export function PostContent({ html }: { html: string }) {
  // content_html do chủ blog (tin cậy) tạo từ editor — chưa sanitize (xem spec §1).
  return (
    <article
      className="prose prose-neutral max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 2: Viết `apps/web/src/app/blog/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedBySlug, listAllPublished } from "@/features/posts/api";
import { PostContent } from "@/features/posts/components/post-content";
import { TagBadge } from "@/features/posts/components/tag-badge";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await listAllPublished();
  return posts.map((p) => ({ slug: p.slug }));
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getPublishedBySlug(params.slug);
  if (!post) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-bold">{post.title}</h1>
      {post.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <TagBadge key={t.slug} tag={t} />
          ))}
        </div>
      ) : null}
      <div className="mt-8">
        <PostContent html={post.content_html} />
      </div>
    </main>
  );
}
```

> `generateMetadata` được thêm ở Task 9 (cùng chỗ builder SEO) để tránh nhắc lại code chưa có.

- [ ] **Step 3: Build kiểm tra**

Run: `pnpm --filter @ultimate/web build`
Expected: build OK; route `/blog/[slug]` xuất hiện (SSG + fallback ISR).

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): trang chi tiết /blog/[slug] (SSG+ISR, notFound bài non-PUBLISHED)"
```

---

## Task 8: Trang tag `/tags` + `/tags/[slug]`

**Files:**
- Create: `apps/web/src/app/tags/page.tsx`
- Create: `apps/web/src/app/tags/[slug]/page.tsx`

**Interfaces:**
- Consumes: `listTags`, `listPublished`, `PostList`, `Pagination`, `totalPages`, `PAGE_SIZE`.

- [ ] **Step 1: Viết `apps/web/src/app/tags/page.tsx`**

```tsx
import Link from "next/link";
import { listTags } from "@/features/posts/api";
import { Badge } from "@ultimate/ui";

export const revalidate = 60;

export default async function TagsPage() {
  const tags = await listTags();
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">Tags</h1>
      {tags.length === 0 ? (
        <p className="text-muted-foreground">Chưa có tag nào.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map((t) => (
            <Link key={t.slug} href={`/tags/${t.slug}`}>
              <Badge>{t.name}</Badge>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Viết `apps/web/src/app/tags/[slug]/page.tsx`**

```tsx
import { listPublished, listTags } from "@/features/posts/api";
import { PostList } from "@/features/posts/components/post-list";
import { Pagination } from "@/features/posts/components/pagination";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

export async function generateStaticParams() {
  const tags = await listTags();
  return tags.map((t) => ({ slug: t.slug }));
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { page?: string };
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const { data, total } = await listPublished({ page, tag: params.slug });
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-8 text-3xl font-bold">#{params.slug}</h1>
      <PostList posts={data} />
      <Pagination
        page={page}
        totalPages={totalPages(total, PAGE_SIZE)}
        basePath={`/tags/${params.slug}`}
      />
    </main>
  );
}
```

- [ ] **Step 3: Build kiểm tra**

Run: `pnpm --filter @ultimate/web build`
Expected: build OK; routes `/tags` và `/tags/[slug]` xuất hiện.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): trang /tags và /tags/[slug] (lọc bài theo tag + phân trang)"
```

---

## Task 9: SEO metadata builder (TDD) + `generateMetadata`

**Files:**
- Create: `apps/web/src/features/posts/metadata.ts`
- Test: `apps/web/src/features/posts/metadata.test.ts`
- Modify: `apps/web/src/app/blog/[slug]/page.tsx` — thêm `generateMetadata`.

**Interfaces:**
- Produces: `buildPostMetadata(post: Post): Metadata`.
- Consumes: `SITE_URL`, `SITE_NAME`.

- [ ] **Step 1: Viết test thất bại `metadata.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildPostMetadata } from "./metadata";

const post = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Tiêu đề gốc",
  slug: "tieu-de",
  content_json: {},
  content_html: "<p/>",
  excerpt: "tóm tắt bài",
  cover_image: "https://cdn.example/x.png",
  status: "PUBLISHED" as const,
  meta_title: null,
  meta_desc: null,
  published_at: "2026-07-01T00:00:00Z",
  tags: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("buildPostMetadata", () => {
  it("dùng title khi meta_title null; description = excerpt", () => {
    const m = buildPostMetadata(post);
    expect(m.title).toBe("Tiêu đề gốc");
    expect(m.description).toBe("tóm tắt bài");
  });
  it("ưu tiên meta_title/meta_desc khi có", () => {
    const m = buildPostMetadata({ ...post, meta_title: "SEO title", meta_desc: "SEO desc" });
    expect(m.title).toBe("SEO title");
    expect(m.description).toBe("SEO desc");
  });
  it("OG có type article, cover_image, publishedTime", () => {
    const m = buildPostMetadata(post);
    expect(m.openGraph?.type).toBe("article");
    expect(JSON.stringify(m.openGraph?.images)).toContain("https://cdn.example/x.png");
  });
  it("canonical trỏ /blog/<slug>", () => {
    const m = buildPostMetadata(post);
    expect(m.alternates?.canonical).toContain("/blog/tieu-de");
  });
});
```

- [ ] **Step 2: Chạy test để fail**

Run: `pnpm --filter @ultimate/web test metadata`
Expected: FAIL (module chưa có).

- [ ] **Step 3: Viết `metadata.ts`**

```ts
import type { Metadata } from "next";
import type { Post } from "@ultimate/types";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export function buildPostMetadata(post: Post): Metadata {
  const title = post.meta_title ?? post.title;
  const description = post.meta_desc ?? post.excerpt ?? "";
  const url = `${SITE_URL}/blog/${post.slug}`;
  const images = post.cover_image ? [{ url: post.cover_image }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: SITE_NAME,
      publishedTime: post.published_at ?? undefined,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}
```

- [ ] **Step 4: Chạy test để pass**

Run: `pnpm --filter @ultimate/web test metadata`
Expected: PASS.

- [ ] **Step 5: Thêm `generateMetadata` vào `blog/[slug]/page.tsx`**

Thêm import + hàm (đặt trên `export default`):

```tsx
import { buildPostMetadata } from "@/features/posts/metadata";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPublishedBySlug(params.slug);
  if (!post) return {};
  return buildPostMetadata(post);
}
```

(`Metadata` đã import từ `next` ở Task 7.)

- [ ] **Step 6: Build kiểm tra**

Run: `pnpm --filter @ultimate/web build`
Expected: build OK.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): SEO metadata + OpenGraph per-post (generateMetadata) + test"
```

---

## Task 10: `sitemap.xml` + `robots.txt`

**Files:**
- Create: `apps/web/src/app/sitemap.ts`
- Create: `apps/web/src/app/robots.ts`

**Interfaces:**
- Consumes: `listAllPublished`, `listTags`, `SITE_URL`.

- [ ] **Step 1: Viết `apps/web/src/app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { listAllPublished, listTags } from "@/features/posts/api";
import { SITE_URL } from "@/lib/config";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, tags] = await Promise.all([listAllPublished(), listTags()]);
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/tags` },
    ...tags.map((t) => ({ url: `${SITE_URL}/tags/${t.slug}` })),
    ...posts.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: p.updated_at,
    })),
  ];
}
```

- [ ] **Step 2: Viết `apps/web/src/app/robots.ts`**

```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Build kiểm tra**

Run: `pnpm --filter @ultimate/web build`
Expected: build OK; xuất hiện `/sitemap.xml` và `/robots.txt`.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat(web): sitemap.xml + robots.txt động (bài PUBLISHED + tag)"
```

---

## Task 11: RSS builder (TDD) + `/rss.xml`

**Files:**
- Create: `apps/web/src/features/posts/rss.ts`
- Test: `apps/web/src/features/posts/rss.test.ts`
- Create: `apps/web/src/app/rss.xml/route.ts`

**Interfaces:**
- Produces: `buildRssXml(posts: Post[], siteUrl: string, siteName: string): string`.
- Consumes: `listAllPublished`, `SITE_URL`, `SITE_NAME`.

- [ ] **Step 1: Viết test thất bại `rss.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildRssXml } from "./rss";

const post = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "A & B <script>",
  slug: "a-b",
  content_json: {},
  content_html: "<p/>",
  excerpt: "mô tả",
  cover_image: null,
  status: "PUBLISHED" as const,
  meta_title: null,
  meta_desc: null,
  published_at: "2026-07-01T00:00:00Z",
  tags: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("buildRssXml", () => {
  it("sinh khung RSS 2.0 hợp lệ", () => {
    const xml = buildRssXml([post], "https://site.test", "Ultimate website");
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("<item>");
    expect(xml).toContain("https://site.test/blog/a-b");
  });
  it("escape ký tự đặc biệt trong title", () => {
    const xml = buildRssXml([post], "https://site.test", "S");
    expect(xml).toContain("A &amp; B &lt;script&gt;");
    expect(xml).not.toContain("<script>");
  });
  it("rỗng khi không có bài", () => {
    const xml = buildRssXml([], "https://site.test", "S");
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});
```

- [ ] **Step 2: Chạy test để fail**

Run: `pnpm --filter @ultimate/web test rss`
Expected: FAIL (module chưa có).

- [ ] **Step 3: Viết `rss.ts`**

```ts
import type { Post } from "@ultimate/types";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssXml(posts: Post[], siteUrl: string, siteName: string): string {
  const items = posts
    .map((p) => {
      const link = `${siteUrl}/blog/${p.slug}`;
      const pubDate = p.published_at ? new Date(p.published_at).toUTCString() : "";
      return [
        "    <item>",
        `      <title>${escapeXml(p.title)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        `      <description>${escapeXml(p.excerpt ?? "")}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    `    <title>${escapeXml(siteName)}</title>`,
    `    <link>${siteUrl}</link>`,
    `    <description>${escapeXml(siteName)}</description>`,
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
```

- [ ] **Step 4: Chạy test để pass**

Run: `pnpm --filter @ultimate/web test rss`
Expected: PASS.

- [ ] **Step 5: Viết `apps/web/src/app/rss.xml/route.ts`**

```ts
import { listAllPublished } from "@/features/posts/api";
import { buildRssXml } from "@/features/posts/rss";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const revalidate = 60;

export async function GET() {
  const posts = await listAllPublished();
  const xml = buildRssXml(posts, SITE_URL, SITE_NAME);
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
```

- [ ] **Step 6: Build + toàn bộ test web**

Run: `pnpm --filter @ultimate/web build && pnpm --filter @ultimate/web test`
Expected: build OK; tất cả test (api, pagination, metadata, rss) PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): RSS feed /rss.xml (builder thuần + route) + test"
```

---

## Task 12: Verify E2E (web + admin regression) + tài liệu

**Files:**
- Create: `apps/web/README.md`
- Modify: `CLAUDE.md` — đánh dấu Slice 4 DONE + mục apps/web/packages/ui.

**Interfaces:** không có code mới — xác minh + doc.

- [ ] **Step 1: Chạy hạ tầng + core + seed dữ liệu**

```bash
cd /c/Projects/ultimate-website
docker compose up -d
cd services/core && go run ./cmd/api   # cổng :8080 (chạy nền/terminal riêng)
```
Dùng admin (hoặc `curl` có auth) tạo: ≥2 bài **PUBLISHED** (mỗi bài có tag, 1 bài có `cover_image`), ≥1 bài **DRAFT**. Đủ để test phân trang thì tạo >`PAGE_SIZE` (10) bài PUBLISHED nếu muốn (tùy chọn).

- [ ] **Step 2: Build + start web**

```bash
pnpm --filter @ultimate/web build && pnpm --filter @ultimate/web start
```
Expected: server chạy `http://localhost:3000`.

- [ ] **Step 3: Kiểm tra bằng trình duyệt (Playwright/Chrome DevTools MCP)**

Xác minh:
- `/` — hiện các bài PUBLISHED (card có cover/tiêu đề/excerpt/tag); nếu >10 bài, `?page=2` đổi trang.
- `/blog/<slug-published>` — render nội dung; xem `<head>` có `<meta property="og:*">` + `<link rel="canonical">`.
- `/blog/<slug-draft>` — trả **404** (Next not-found).
- `/tags` — liệt kê tag; `/tags/<slug>` — chỉ bài của tag đó.
- `curl -s localhost:3000/sitemap.xml` — có URL bài + tag.
- `curl -s localhost:3000/rss.xml` — RSS 2.0 hợp lệ, có item.
- `curl -s localhost:3000/robots.txt` — allow `/` + trỏ sitemap.

- [ ] **Step 4: Admin regression**

```bash
pnpm --filter @ultimate/admin test
pnpm --filter @ultimate/admin build
```
Expected: test xanh + build OK. Mở admin dev, xác nhận UI không đổi.

- [ ] **Step 5: Build toàn monorepo**

Run: `pnpm build`
Expected: Turbo build tất cả (`@ultimate/ui` typecheck, `admin`, `web`) xanh.

- [ ] **Step 6: Viết `apps/web/README.md`**

```markdown
# @ultimate/web — Blog công khai (Next.js)

Blog công khai (App Router, React 18, Tailwind v3), đọc dữ liệu từ Go core, SSG + ISR.

## Chạy dev
1. Core chạy `:8080` (xem `services/core/README.md`).
2. `cp .env.example .env.local` (chỉnh nếu cần).
3. `pnpm --filter @ultimate/web dev` → http://localhost:3000

## Env
- `CORE_API_URL` (server-only) — base URL core, mặc định `http://localhost:8080`.
- `NEXT_PUBLIC_SITE_URL` — URL công khai (canonical/sitemap/rss/OG).
- `NEXT_PUBLIC_MEDIA_HOST` — host ảnh cho `next/image` remotePatterns.

## Trang
- `/` danh sách bài PUBLISHED (+`?page=`), `/blog/[slug]`, `/tags`, `/tags/[slug]`.
- SEO: metadata/OG mỗi bài, `/sitemap.xml`, `/rss.xml`, `/robots.txt`.

Dữ liệu chỉ hiển thị bài `PUBLISHED`; slug non-PUBLISHED → 404.
```

- [ ] **Step 7: Cập nhật `CLAUDE.md`**

Thêm mục Slice 4 DONE vào phần "Trạng thái hiện tại" (sau Slice 3e), ghi rõ: `apps/web` Next.js (SSG+ISR, ép PUBLISHED, SEO đầy đủ), `packages/ui` chung + admin đã migrate. Đổi dòng "⏳ Slice 4" cho khớp. Trỏ spec `docs/superpowers/specs/2026-07-10-slice4-web-public-blog-design.md`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/README.md CLAUDE.md
git commit -m "docs(slice4): README web + đánh dấu Slice 4 DONE trong CLAUDE.md"
```

- [ ] **Step 9: Hoàn tất nhánh**

Dùng skill `superpowers:finishing-a-development-branch` để chọn merge/PR về `main`.

---

## Self-Review

**Spec coverage:**
- packages/ui (spec §3) → Task 1–2; migrate admin (§3.5) → Task 3. ✅
- apps/web scaffold + config (§4.1, §4.5) → Task 4. ✅
- Data layer, ép PUBLISHED, notFound (§4.2) → Task 5. ✅
- Trang chủ + phân trang (§4.3) → Task 6. ✅
- `/blog/[slug]` + SSG + generateStaticParams (§4.3) → Task 7. ✅
- `/tags` + `/tags/[slug]` (§4.3) → Task 8. ✅
- SEO metadata/OG (§4.4) → Task 9; sitemap + robots (§4.4) → Task 10; RSS (§4.4) → Task 11. ✅
- Test TDD (§5) → test trong Task 1,5,6,9,11. ✅
- Verify E2E + admin regression + docs (§6, §8) → Task 12. ✅
- ISR/`revalidate=60` (§2) → mỗi page/route export `revalidate = 60`. ✅

**Placeholder scan:** page.tsx Task 4 là placeholder có chủ đích, được thay ở Task 6 (đã ghi rõ). `generateMetadata` hoãn sang Task 9 (đã ghi chú ở Task 7). Không có TODO/TBD thực sự.

**Type consistency:** field snake_case đồng nhất (`content_html`, `cover_image`, `published_at`, `page_size`, `updated_at`); `getPublishedBySlug` trả `Post | null`; `listPublished` trả `PostListResponse`; `buildPostMetadata(post): Metadata`; `buildRssXml(posts, siteUrl, siteName)`; `totalPages(total, pageSize)`/`pageHref(basePath, page)` khớp giữa định nghĩa (Task 6) và nơi dùng (Task 8, pagination.tsx). ✅
