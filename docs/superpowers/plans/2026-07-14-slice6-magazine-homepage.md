# Slice 6 — Trang chủ blog "Mạch" (UI/UX) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại pixel-close trang chủ tạp chí "Mạch" (phương án 2a) trong `apps/web`, ưu tiên UX/UI, nối dữ liệu thật từ Go core, tương tác chạy cục bộ qua service seam.

**Architecture:** Server Component (`app/page.tsx`) fetch + adapt `Post[] → ArticleVM[]`, truyền vào 1 client island `MagazineBoard`. State tương tác trong Zustand (selector chống re-render). Token Mạch scope riêng web; tương tác (bookmark/auth/newsletter) chạy cục bộ qua interface service để cắm backend thật sau.

**Tech Stack:** Next.js 14 App Router (RSC), React 18, TypeScript, Tailwind v3, Zustand, lucide-react, next/font, type-fest, Vitest + Testing Library (jsdom).

## Global Constraints

- **Không hardcode màu trong component:** màu nền/chữ/viền qua class Tailwind ngữ nghĩa (`bg-surface text-fg border-line`…); màu category qua bảng `categories.ts` (single source) áp bằng inline `style` từ dữ liệu, không viết hex rời rạc.
- **Chống re-render:** `React.memo` cho component lặp; `useDeferredValue` cho search; Zustand selector; hàm lọc/format là hàm thuần tách khỏi component.
- **Utils không nằm trong component:** mọi hàm thuần đặt ở `features/magazine/lib/*`.
- **Giữ SEO/SSG:** `app/page.tsx` là Server Component, giữ `export const revalidate = 60`; không hồi quy sitemap/rss/robots/metadata hiện có.
- **Token Mạch chỉ scope `apps/web`** — không sửa `packages/ui` (admin dùng chung).
- **Font:** Bricolage Grotesque (display) / Be Vietnam Pro (sans) / Space Mono (mono) qua `next/font/google`.
- **Giá trị token (verbatim từ spec):**
  - Light: `--bg #f6f3ec` · `--surface #fffdf8` · `--fg #1c1a16` · `--muted #726a5b` · `--line rgba(28,26,22,.11)` · `--soft rgba(28,26,22,.045)` · `--tint-strength 13%`
  - Dark: `--bg #151310` · `--surface #201d18` · `--fg #efe9df` · `--muted #a89d8b` · `--line rgba(239,233,223,.14)` · `--soft rgba(239,233,223,.05)` · `--tint-strength 24%`
  - `--accent #1668e3` · `--accent-fg #ffffff` · `--highlight #ffcf33`
  - Category: IT `#2f6df6` · AI `#7048e8` · Tài chính `#0b8a6f` · Chứng khoán `#e8590c` · Kiến trúc `#5f6b7a` · Văn hóa `#e8843c` · Giải trí `#e64980` · Tin tức `#0ca678` · Phát triển bản thân `#37b24d` · Review sách `#e8590c` · Tất cả = accent `#1668e3`
- **Commit thường xuyên**, mỗi task ≥ 1 commit.

---

## File Structure

**Tạo mới:**
- `apps/web/src/features/magazine/categories.ts` — bảng Category single source
- `apps/web/src/features/magazine/types.ts` — `ArticleVM`, `CategoryKey`, `MockUser`, `Category`
- `apps/web/src/features/magazine/lib/format.ts` — `formatViews`, `formatDate`, `readTimeFromHtml`
- `apps/web/src/features/magazine/lib/article-vm.ts` — `postToArticleVM`, `postsToArticleVMs`
- `apps/web/src/features/magazine/lib/filter.ts` — `filterArticles`
- `apps/web/src/features/magazine/services/bookmark-service.ts` — interface + `LocalBookmarkService`
- `apps/web/src/features/magazine/services/newsletter-service.ts` — interface + `LocalNewsletterService`
- `apps/web/src/features/magazine/store/magazine-store.ts` — Zustand store
- `apps/web/src/features/magazine/hooks/use-theme.ts` — dark mode
- `apps/web/src/features/magazine/components/*` — component (mục các task)
- `apps/web/src/app/loading.tsx` — skeleton route-level
- `apps/web/src/test/setup.ts` — Testing Library setup
- `services/core/seed/seed_articles.sql` — seed idempotent

**Sửa:**
- `apps/web/package.json` — thêm deps
- `apps/web/tailwind.config.ts` — màu + font Mạch
- `apps/web/src/app/globals.css` — token Mạch (`:root`/`.dark`)
- `apps/web/src/app/layout.tsx` — font mới + theme script + chrome mới
- `apps/web/src/app/page.tsx` — server fetch + MagazineBoard
- `apps/web/next.config.mjs` — host ảnh seed + img-src CSP
- `apps/web/vitest.config.ts` — jsdom + setup
- `README.md` + `services/core/README.md` — lệnh seed
- `CLAUDE.md` — cập nhật tiến độ

---

## Task 1: Nền tảng — deps, token CSS, Tailwind, font, categories, types

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/features/magazine/types.ts`
- Create: `apps/web/src/features/magazine/categories.ts`

**Interfaces:**
- Produces:
  - `type CategoryKey = "all"|"it"|"ai"|"finance"|"stock"|"arch"|"culture"|"ent"|"news"|"growth"|"book"`
  - `interface Category { key: CategoryKey; label: string; color: string; icon: LucideIcon }`
  - `interface ArticleVM { id: string; slug: string; title: string; excerpt: string; category: CategoryKey; categoryLabel: string; color: string; date: string; dateLabel: string; readTime: string; coverImage: string | null; author: string | null; views: number | null; comments: number | null }`
  - `interface MockUser { name: string; email: string }`
  - `CATEGORIES: readonly Category[]`, `CATEGORY_BY_KEY: Record<CategoryKey, Category>`, `categoryFromTags(tags: {name:string;slug:string}[]): CategoryKey`

- [ ] **Step 1: Thêm dependencies**

Chạy tại gốc repo:

```bash
pnpm --filter @ultimate/web add zustand lucide-react type-fest
pnpm --filter @ultimate/web add -D jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react
```

Expected: `package.json` của web có `zustand`, `lucide-react`, `type-fest` ở dependencies; `jsdom`, `@testing-library/*`, `@vitejs/plugin-react` ở devDependencies.

- [ ] **Step 2: Token Mạch vào `globals.css`**

Thay khối `:root` font-vars hiện có bằng khối dưới (giữ nguyên phần `@import`, `@tailwind`, `.article-*`, `.card-lift` bên dưới file — chỉ thêm/không xoá editorial styles). Chèn ngay sau dòng `@tailwind utilities;`:

```css
/* ---------- Mạch design tokens (scope: apps/web) ---------- */
:root {
  --bg: #f6f3ec;
  --surface: #fffdf8;
  --fg: #1c1a16;
  --muted: #726a5b;
  --line: rgba(28, 26, 22, 0.11);
  --soft: rgba(28, 26, 22, 0.045);
  --accent: #1668e3;
  --accent-fg: #ffffff;
  --highlight: #ffcf33;
  --tint-strength: 13%;
  --shadow-modal: 0 30px 80px rgba(0, 0, 0, 0.45);

  --font-display: var(--font-display-next), "Bricolage Grotesque", ui-sans-serif, sans-serif;
  --font-sans: var(--font-sans-next), "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono-next), "Space Mono", ui-monospace, monospace;
}
.dark {
  --bg: #151310;
  --surface: #201d18;
  --fg: #efe9df;
  --muted: #a89d8b;
  --line: rgba(239, 233, 223, 0.14);
  --soft: rgba(239, 233, 223, 0.05);
  --tint-strength: 24%;
}
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
}
```

> Lưu ý: file vẫn `@import "@ultimate/ui/styles/theme.css"` ở đầu — token Mạch khai báo SAU nên override cho web. Không xoá `.article-*` (trang detail còn dùng).

- [ ] **Step 3: Map token vào Tailwind**

Ghi đè `apps/web/tailwind.config.ts`:

```ts
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
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        serif: ["Lora", "Georgia", "serif"],
      },
      maxWidth: { prose: "42rem", shell: "1160px" },
      boxShadow: { modal: "var(--shadow-modal)" },
    },
  },
  plugins: [typography],
};

export default config;
```

- [ ] **Step 4: `types.ts`**

```ts
import type { LucideIcon } from "lucide-react";

export type CategoryKey =
  | "all" | "it" | "ai" | "finance" | "stock" | "arch"
  | "culture" | "ent" | "news" | "growth" | "book";

export interface Category {
  key: CategoryKey;
  label: string;
  color: string; // hex — nguồn duy nhất cho màu category
  icon: LucideIcon;
}

export interface ArticleVM {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: CategoryKey;
  categoryLabel: string;
  color: string;
  date: string;      // ISO
  dateLabel: string; // dd/mm/yyyy
  readTime: string;  // "N phút"
  coverImage: string | null;
  author: string | null;
  views: number | null;
  comments: number | null;
}

export interface MockUser {
  name: string;
  email: string;
}
```

- [ ] **Step 5: `categories.ts`**

```ts
import {
  Grid, Code, Sparkles, CircleDollarSign, BarChart3, Compass,
  Landmark, PlayCircle, Newspaper, TrendingUp, BookOpen,
} from "lucide-react";
import type { Category, CategoryKey } from "./types";

const ACCENT = "#1668e3";

export const CATEGORIES = [
  { key: "all", label: "Tất cả", color: ACCENT, icon: Grid },
  { key: "it", label: "IT", color: "#2f6df6", icon: Code },
  { key: "ai", label: "AI", color: "#7048e8", icon: Sparkles },
  { key: "finance", label: "Tài chính", color: "#0b8a6f", icon: CircleDollarSign },
  { key: "stock", label: "Chứng khoán", color: "#e8590c", icon: BarChart3 },
  { key: "arch", label: "Kiến trúc", color: "#5f6b7a", icon: Compass },
  { key: "culture", label: "Văn hóa", color: "#e8843c", icon: Landmark },
  { key: "ent", label: "Giải trí", color: "#e64980", icon: PlayCircle },
  { key: "news", label: "Tin tức", color: "#0ca678", icon: Newspaper },
  { key: "growth", label: "Phát triển bản thân", color: "#37b24d", icon: TrendingUp },
  { key: "book", label: "Review sách", color: "#e8590c", icon: BookOpen },
] as const satisfies readonly Category[];

export const CATEGORY_BY_KEY = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, Category>;

// Map tag (theo slug rồi tới name, không phân biệt hoa thường) → CategoryKey.
// Không khớp → "news" (mặc định trung tính, xác định).
const LOOKUP: Record<string, CategoryKey> = CATEGORIES.reduce((acc, c) => {
  acc[c.label.toLowerCase()] = c.key;
  acc[c.key] = c.key;
  return acc;
}, {} as Record<string, CategoryKey>);

export function categoryFromTags(
  tags: ReadonlyArray<{ name: string; slug: string }>,
): CategoryKey {
  for (const t of tags) {
    const hit = LOOKUP[t.slug?.toLowerCase()] ?? LOOKUP[t.name?.toLowerCase()];
    if (hit && hit !== "all") return hit;
  }
  return "news";
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ultimate/web exec tsc --noEmit`
Expected: PASS (0 lỗi). Nếu báo thiếu type lucide → đảm bảo `lucide-react` đã cài (Step 1).

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml pnpm-lock.yaml apps/web/src/app/globals.css apps/web/tailwind.config.ts apps/web/src/features/magazine/types.ts apps/web/src/features/magazine/categories.ts
git commit -m "feat(web): nền tảng Mạch — deps, token, tailwind, categories, types"
```

---

## Task 2: Lib thuần (format, article-vm, filter) — TDD

**Files:**
- Create + Test: `apps/web/src/features/magazine/lib/format.ts` + `format.test.ts`
- Create + Test: `apps/web/src/features/magazine/lib/article-vm.ts` + `article-vm.test.ts`
- Create + Test: `apps/web/src/features/magazine/lib/filter.ts` + `filter.test.ts`

**Interfaces:**
- Consumes: `ArticleVM`, `categoryFromTags`, `CATEGORY_BY_KEY` (Task 1); `Post` từ `@ultimate/types`.
- Produces:
  - `formatViews(n: number): string` — 11000→"11k", 950→"950", 1_200_000→"1.2m"
  - `formatDate(iso: string): string` — "2026-07-12T…"→"12/07/2026"
  - `readTimeFromHtml(html: string): string` — đếm từ (strip tag) / 200, tối thiểu 1 → "N phút"
  - `postToArticleVM(post: Post): ArticleVM`
  - `postsToArticleVMs(posts: Post[]): ArticleVM[]`
  - `filterArticles(items: ArticleVM[], query: string, cat: CategoryKey): ArticleVM[]`

- [ ] **Step 1: Test `format.ts`**

Tạo `apps/web/src/features/magazine/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatViews, formatDate, readTimeFromHtml } from "./format";

describe("formatViews", () => {
  it("giữ nguyên số nhỏ", () => expect(formatViews(950)).toBe("950"));
  it("rút gọn nghìn", () => expect(formatViews(11000)).toBe("11k"));
  it("nghìn lẻ có 1 chữ số thập phân", () => expect(formatViews(11500)).toBe("11.5k"));
  it("rút gọn triệu", () => expect(formatViews(1_200_000)).toBe("1.2m"));
});

describe("formatDate", () => {
  it("ISO → dd/mm/yyyy", () => expect(formatDate("2026-07-12T10:00:00Z")).toBe("12/07/2026"));
});

describe("readTimeFromHtml", () => {
  it("đếm từ / 200 wpm, tối thiểu 1", () => {
    expect(readTimeFromHtml("<p>một hai ba</p>")).toBe("1 phút");
  });
  it("400 từ ≈ 2 phút", () => {
    const html = "<p>" + Array(400).fill("từ").join(" ") + "</p>";
    expect(readTimeFromHtml(html)).toBe("2 phút");
  });
});
```

- [ ] **Step 2: Chạy test — kỳ vọng FAIL**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/lib/format.test.ts`
Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Viết `format.ts`**

```ts
export function formatViews(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? k.toString() : k.toFixed(1)) + "k";
  }
  const m = n / 1_000_000;
  return (Number.isInteger(m) ? m.toString() : m.toFixed(1)) + "m";
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function readTimeFromHtml(html: string): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(" ").length : 0;
  return `${Math.max(1, Math.round(words / 200))} phút`;
}
```

- [ ] **Step 4: Chạy test — kỳ vọng PASS**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Test `article-vm.ts`**

Tạo `apps/web/src/features/magazine/lib/article-vm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { postToArticleVM } from "./article-vm";
import type { Post } from "@ultimate/types";

const base: Post = {
  id: "11111111-1111-1111-1111-111111111111" as Post["id"],
  title: "Bài mẫu", slug: "bai-mau",
  content_json: {}, content_html: "<p>" + Array(200).fill("x").join(" ") + "</p>",
  excerpt: "Mô tả ngắn", cover_image: "https://x/i.jpg", status: "PUBLISHED",
  meta_title: null, meta_desc: null, published_at: "2026-07-12T10:00:00Z",
  version: 1, tags: [{ id: "t" as never, name: "AI", slug: "ai" }],
  created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-12T00:00:00Z",
};

describe("postToArticleVM", () => {
  it("map category từ tag", () => {
    expect(postToArticleVM(base).category).toBe("ai");
    expect(postToArticleVM(base).categoryLabel).toBe("AI");
  });
  it("dùng published_at cho date, fallback created_at khi null", () => {
    expect(postToArticleVM(base).dateLabel).toBe("12/07/2026");
    expect(postToArticleVM({ ...base, published_at: null }).dateLabel).toBe("01/07/2026");
  });
  it("tính readTime từ html", () => {
    expect(postToArticleVM(base).readTime).toBe("1 phút");
  });
  it("field backend chưa có = null", () => {
    const vm = postToArticleVM(base);
    expect(vm.author).toBeNull();
    expect(vm.views).toBeNull();
    expect(vm.comments).toBeNull();
  });
  it("excerpt null → chuỗi rỗng", () => {
    expect(postToArticleVM({ ...base, excerpt: null }).excerpt).toBe("");
  });
  it("không tag → category news", () => {
    expect(postToArticleVM({ ...base, tags: [] }).category).toBe("news");
  });
});
```

- [ ] **Step 6: Chạy test — FAIL**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/lib/article-vm.test.ts`
Expected: FAIL.

- [ ] **Step 7: Viết `article-vm.ts`**

```ts
import type { Post } from "@ultimate/types";
import type { ArticleVM } from "../types";
import { categoryFromTags, CATEGORY_BY_KEY } from "../categories";
import { formatDate, readTimeFromHtml } from "./format";

export function postToArticleVM(post: Post): ArticleVM {
  const category = categoryFromTags(post.tags);
  const cfg = CATEGORY_BY_KEY[category];
  const date = post.published_at ?? post.created_at;
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? "",
    category,
    categoryLabel: cfg.label,
    color: cfg.color,
    date,
    dateLabel: formatDate(date),
    readTime: readTimeFromHtml(post.content_html),
    coverImage: post.cover_image,
    author: null,
    views: null,
    comments: null,
  };
}

export function postsToArticleVMs(posts: Post[]): ArticleVM[] {
  return posts.map(postToArticleVM);
}
```

- [ ] **Step 8: Chạy test — PASS**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/lib/article-vm.test.ts`
Expected: PASS.

- [ ] **Step 9: Test `filter.ts`**

Tạo `apps/web/src/features/magazine/lib/filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterArticles } from "./filter";
import type { ArticleVM } from "../types";

const mk = (p: Partial<ArticleVM>): ArticleVM => ({
  id: "1", slug: "s", title: "", excerpt: "", category: "it", categoryLabel: "IT",
  color: "#000", date: "", dateLabel: "", readTime: "", coverImage: null,
  author: null, views: null, comments: null, ...p,
});
const items = [
  mk({ id: "1", title: "Học Go", category: "it", categoryLabel: "IT" }),
  mk({ id: "2", title: "Mạng nơ-ron", category: "ai", categoryLabel: "AI", excerpt: "deep learning" }),
  mk({ id: "3", title: "Cổ phiếu", category: "stock", categoryLabel: "Chứng khoán" }),
];

describe("filterArticles", () => {
  it("cat=all trả hết", () => expect(filterArticles(items, "", "all")).toHaveLength(3));
  it("lọc theo category", () => {
    expect(filterArticles(items, "", "ai").map((i) => i.id)).toEqual(["2"]);
  });
  it("search không phân biệt hoa thường trên title", () => {
    expect(filterArticles(items, "go", "all").map((i) => i.id)).toEqual(["1"]);
  });
  it("search khớp excerpt", () => {
    expect(filterArticles(items, "DEEP", "all").map((i) => i.id)).toEqual(["2"]);
  });
  it("search ∩ category", () => {
    expect(filterArticles(items, "cổ", "ai")).toHaveLength(0);
  });
});
```

- [ ] **Step 10: Chạy test — FAIL, rồi viết `filter.ts`**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/lib/filter.test.ts` → FAIL.

```ts
import type { ArticleVM } from "../types";
import type { CategoryKey } from "../types";

export function filterArticles(
  items: ArticleVM[],
  query: string,
  cat: CategoryKey,
): ArticleVM[] {
  const q = query.trim().toLowerCase();
  return items.filter((a) => {
    if (cat !== "all" && a.category !== cat) return false;
    if (!q) return true;
    return (
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.categoryLabel.toLowerCase().includes(q) ||
      (a.author?.toLowerCase().includes(q) ?? false)
    );
  });
}
```

- [ ] **Step 11: Chạy toàn bộ test lib — PASS**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/lib`
Expected: PASS cả 3 file.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/features/magazine/lib
git commit -m "feat(web): lib thuần Mạch — format, article-vm, filter (TDD)"
```

---

## Task 3: Services (bookmark, newsletter) + Zustand store

**Files:**
- Create: `apps/web/src/features/magazine/services/bookmark-service.ts`
- Create: `apps/web/src/features/magazine/services/newsletter-service.ts`
- Create + Test: `apps/web/src/features/magazine/store/magazine-store.ts` + `magazine-store.test.ts`

**Interfaces:**
- Consumes: `MockUser` (Task 1).
- Produces:
  - `interface BookmarkService { load(user: string): Set<string>; toggle(user: string, id: string): Set<string> }` + `localBookmarkService`
  - `interface NewsletterService { subscribe(email: string): Promise<void> }` + `localNewsletterService`
  - Zustand: `useMagazineStore` với state `{ query, cat, saved: Record<string,true>, user: MockUser|null, authOpen, authMode, toast }` + actions `setQuery, setCat, toggleSave(id), login(user), logout, openAuth(mode,msg?), closeAuth, setToast, clearToast`. Selector helper: `useToast()`, `useSavedCount()`.

- [ ] **Step 1: `bookmark-service.ts`**

```ts
const KEY = (user: string) => `mach:bookmarks:${user}`;

export interface BookmarkService {
  load(user: string): Set<string>;
  toggle(user: string, id: string): Set<string>;
}

export const localBookmarkService: BookmarkService = {
  load(user) {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(KEY(user)) ?? "[]"));
    } catch {
      return new Set();
    }
  },
  toggle(user, id) {
    const set = this.load(user);
    set.has(id) ? set.delete(id) : set.add(id);
    localStorage.setItem(KEY(user), JSON.stringify([...set]));
    return set;
  },
};
```

- [ ] **Step 2: `newsletter-service.ts`**

```ts
export interface NewsletterService {
  subscribe(email: string): Promise<void>;
}

// Impl cục bộ (mock) — TODO Phase sau: POST /subscribers hoặc Firestore.
export const localNewsletterService: NewsletterService = {
  async subscribe(email) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("mach:subscribers") ?? "[]";
      const list = new Set<string>(JSON.parse(raw));
      list.add(email);
      localStorage.setItem("mach:subscribers", JSON.stringify([...list]));
    }
  },
};
```

- [ ] **Step 3: Test store**

Tạo `apps/web/src/features/magazine/store/magazine-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useMagazineStore } from "./magazine-store";

const reset = () =>
  useMagazineStore.setState({
    query: "", cat: "all", saved: {}, user: null,
    authOpen: false, authMode: "login", toast: null,
  });

describe("magazine-store", () => {
  beforeEach(reset);

  it("setCat + setQuery", () => {
    useMagazineStore.getState().setCat("ai");
    useMagazineStore.getState().setQuery("go");
    expect(useMagazineStore.getState().cat).toBe("ai");
    expect(useMagazineStore.getState().query).toBe("go");
  });

  it("toggleSave khi chưa login → mở auth với message, không lưu", () => {
    useMagazineStore.getState().toggleSave("a1");
    const s = useMagazineStore.getState();
    expect(s.saved["a1"]).toBeUndefined();
    expect(s.authOpen).toBe(true);
    expect(s.toast).toMatch(/Đăng nhập/);
  });

  it("login rồi toggleSave → lưu/bỏ lưu", () => {
    useMagazineStore.getState().login({ name: "A", email: "a@b.co" });
    useMagazineStore.getState().toggleSave("a1");
    expect(useMagazineStore.getState().saved["a1"]).toBe(true);
    useMagazineStore.getState().toggleSave("a1");
    expect(useMagazineStore.getState().saved["a1"]).toBeUndefined();
  });

  it("logout xoá user + saved", () => {
    useMagazineStore.getState().login({ name: "A", email: "a@b.co" });
    useMagazineStore.getState().toggleSave("a1");
    useMagazineStore.getState().logout();
    expect(useMagazineStore.getState().user).toBeNull();
    expect(useMagazineStore.getState().saved).toEqual({});
  });
});
```

- [ ] **Step 4: Chạy test — FAIL**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/store`
Expected: FAIL.

- [ ] **Step 5: Viết `magazine-store.ts`**

```ts
import { create } from "zustand";
import type { CategoryKey, MockUser } from "../types";
import { localBookmarkService } from "../services/bookmark-service";

type AuthMode = "login" | "register";

interface MagazineState {
  query: string;
  cat: CategoryKey;
  saved: Record<string, true>;
  user: MockUser | null;
  authOpen: boolean;
  authMode: AuthMode;
  toast: string | null;
  setQuery(q: string): void;
  setCat(c: CategoryKey): void;
  toggleSave(id: string): void;
  login(user: MockUser): void;
  logout(): void;
  openAuth(mode: AuthMode, msg?: string): void;
  closeAuth(): void;
  setToast(msg: string): void;
  clearToast(): void;
}

const savedRecord = (set: Set<string>): Record<string, true> =>
  Object.fromEntries([...set].map((id) => [id, true as const]));

export const useMagazineStore = create<MagazineState>((set, get) => ({
  query: "",
  cat: "all",
  saved: {},
  user: null,
  authOpen: false,
  authMode: "login",
  toast: null,

  setQuery: (query) => set({ query }),
  setCat: (cat) => set({ cat }),

  toggleSave: (id) => {
    const { user } = get();
    if (!user) {
      set({ authOpen: true, authMode: "login", toast: "Đăng nhập để lưu bài viết yêu thích." });
      return;
    }
    const next = localBookmarkService.toggle(user.email, id);
    set({ saved: savedRecord(next), toast: next.has(id) ? "Đã lưu bài viết." : "Đã bỏ lưu." });
  },

  login: (user) =>
    set({ user, authOpen: false, saved: savedRecord(localBookmarkService.load(user.email)), toast: `Xin chào, ${user.name}!` }),

  logout: () => set({ user: null, saved: {}, toast: "Đã đăng xuất." }),

  openAuth: (authMode, msg) => set({ authOpen: true, authMode, toast: msg ?? null }),
  closeAuth: () => set({ authOpen: false }),
  setToast: (toast) => set({ toast }),
  clearToast: () => set({ toast: null }),
}));

// Selector tiện dụng (chống re-render — chỉ subscribe slice cần).
export const useSavedCount = () =>
  useMagazineStore((s) => Object.keys(s.saved).length);
```

- [ ] **Step 6: Chạy test — PASS**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/store`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/magazine/services apps/web/src/features/magazine/store
git commit -m "feat(web): service seam (bookmark/newsletter) + zustand store (TDD)"
```

---

## Task 4: Cấu hình test jsdom + `useTheme` hook

**Files:**
- Create: `apps/web/src/test/setup.ts`
- Modify: `apps/web/vitest.config.ts`
- Create + Test: `apps/web/src/features/magazine/hooks/use-theme.ts` + `use-theme.test.ts`

**Interfaces:**
- Produces: `useTheme(): { dark: boolean; toggle(): void }`; `THEME_SCRIPT: string` (chuỗi JS pre-hydration).

- [ ] **Step 1: Setup Testing Library**

Tạo `apps/web/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

- [ ] **Step 2: Cập nhật `vitest.config.ts`**

```ts
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
  },
});
```

- [ ] **Step 3: Chạy lại test cũ để chắc không hồi quy**

Run: `pnpm --filter @ultimate/web test`
Expected: PASS toàn bộ test hiện có (rss/sanitize/metadata/pagination + lib/store mới) dưới jsdom.

- [ ] **Step 4: Test `use-theme.ts`**

Tạo `apps/web/src/features/magazine/hooks/use-theme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "./use-theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("useTheme", () => {
  it("toggle bật/tắt class dark + persist", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.dark).toBe(false);
    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("mach-theme")).toBe("dark");
    act(() => result.current.toggle());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("mach-theme")).toBe("light");
  });
});
```

- [ ] **Step 5: Chạy test — FAIL, rồi viết `use-theme.ts`**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/hooks` → FAIL.

```ts
"use client";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mach-theme";

// Script chạy trước hydration để set class ngay, tránh nháy màu (FOUC).
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export function useTheme(): { dark: boolean; toggle: () => void } {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      return next;
    });
  }, []);

  return { dark, toggle };
}
```

- [ ] **Step 6: Chạy test — PASS**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/hooks`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/test apps/web/vitest.config.ts apps/web/src/features/magazine/hooks
git commit -m "test(web): setup jsdom + Testing Library; feat: useTheme hook (TDD)"
```

---

## Task 5: Component trình bày (memo) + skeleton

**Files:**
- Create: `apps/web/src/features/magazine/components/article-row.tsx`
- Create: `apps/web/src/features/magazine/components/category-rail-item.tsx`
- Create: `apps/web/src/features/magazine/components/trending-chips.tsx`
- Create: `apps/web/src/features/magazine/components/top-viewed-list.tsx`
- Create: `apps/web/src/features/magazine/components/sub-nav.tsx`
- Create: `apps/web/src/features/magazine/components/skeletons/article-row-skeleton.tsx`
- Create + Test: `apps/web/src/features/magazine/components/article-row.test.tsx`

**Interfaces:**
- Consumes: `ArticleVM`, `Category`, `CATEGORIES`, `formatViews`.
- Produces (props):
  - `ArticleRow({ article, index, saved, onToggleSave, onOpen })` — memo
  - `CategoryRailItem({ category, active, onSelect })` — memo
  - `TrendingChips({ categories, onSelect })`, `TopViewedList({ items, onOpen })`
  - `SubNav()`, `ArticleRowSkeleton()`

- [ ] **Step 1: `article-row.tsx`** (áp token qua class; màu category qua inline style từ dữ liệu)

```tsx
import { memo } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import type { ArticleVM } from "../types";
import { formatViews } from "../lib/format";

interface Props {
  article: ArticleVM;
  index: number;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onOpen: (slug: string) => void;
}

function ArticleRowBase({ article, index, saved, onToggleSave, onOpen }: Props) {
  const tint = `color-mix(in srgb, ${article.color} var(--tint-strength), transparent)`;
  return (
    <article
      onClick={() => onOpen(article.slug)}
      className="flex cursor-pointer items-start gap-[18px] border-b border-line py-[19px] [content-visibility:auto]"
    >
      <div
        className="relative flex h-[90px] w-[132px] flex-none items-end overflow-hidden rounded-lg p-[9px]"
        style={{ backgroundColor: article.color }}
      >
        {article.coverImage && (
          <Image
            src={article.coverImage}
            alt=""
            fill
            sizes="132px"
            className="object-cover"
          />
        )}
        <span className="absolute -top-[10px] right-[5px] font-display text-[58px] font-extrabold leading-none text-white/20">
          {index + 1}
        </span>
        <span className="relative rounded bg-black/30 px-[7px] py-[3px] font-mono text-[8.5px] font-bold uppercase tracking-wide text-white">
          {article.categoryLabel}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-[7px] flex items-center gap-[10px]">
          <span
            className="rounded-[5px] px-[9px] py-[3px] text-[11px] font-bold"
            style={{ color: article.color, background: tint }}
          >
            {article.categoryLabel}
          </span>
          <span className="font-mono text-[11px] text-muted">{article.dateLabel}</span>
        </div>
        <h3 className="mb-[6px] font-display text-[20px] font-bold leading-[1.22] tracking-[-0.01em] text-fg">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mb-2 truncate text-[13px] leading-[1.5] text-muted">{article.excerpt}</p>
        )}
        <div className="flex items-center gap-3 text-[11.5px] text-muted">
          {article.author && <span className="font-bold text-fg">{article.author}</span>}
          {article.comments !== null && (
            <>
              <span>·</span>
              <span>{article.comments} bình luận</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-none flex-col items-end gap-[11px]">
        <button
          type="button"
          aria-label={saved ? "Bỏ lưu" : "Lưu bài viết"}
          aria-pressed={saved}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(article.id);
          }}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-fg"
          style={saved ? { color: article.color, background: tint, borderColor: article.color } : undefined}
        >
          <Star size={15} fill={saved ? "currentColor" : "none"} strokeWidth={2} />
        </button>
        <div className="text-right font-mono text-[10.5px] leading-[1.7] text-muted">
          {article.views !== null && <>{formatViews(article.views)}<br /></>}
          {article.readTime}
        </div>
      </div>
    </article>
  );
}

export const ArticleRow = memo(ArticleRowBase);
```

- [ ] **Step 2: `category-rail-item.tsx`**

```tsx
import { memo } from "react";
import type { Category } from "../types";

interface Props {
  category: Category;
  active: boolean;
  onSelect: (key: Category["key"]) => void;
}

function CategoryRailItemBase({ category, active, onSelect }: Props) {
  const Icon = category.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(category.key)}
      className="flex items-center gap-[11px] rounded-[9px] px-[13px] py-[12px] text-left text-[13.5px] font-semibold transition-colors"
      style={
        active
          ? { background: category.color, color: "#fff", boxShadow: `0 6px 16px ${category.color}52` }
          : undefined
      }
    >
      <Icon size={16} strokeWidth={2} style={{ color: active ? "#fff" : category.color }} />
      <span className={active ? "text-white" : "text-fg"}>{category.label}</span>
    </button>
  );
}

export const CategoryRailItem = memo(CategoryRailItemBase);
```

- [ ] **Step 3: `trending-chips.tsx` + `top-viewed-list.tsx` + `sub-nav.tsx` + skeleton**

`trending-chips.tsx`:

```tsx
import { memo } from "react";
import type { Category, CategoryKey } from "../types";

function TrendingChipsBase({
  categories, onSelect,
}: { categories: Category[]; onSelect: (k: CategoryKey) => void }) {
  return (
    <div className="mb-[30px] flex flex-wrap gap-2">
      {categories.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onSelect(c.key)}
          className="rounded-[7px] px-[13px] py-2 text-[12.5px] font-bold"
          style={{ color: c.color, background: `color-mix(in srgb, ${c.color} var(--tint-strength), transparent)` }}
        >
          #{c.label}
        </button>
      ))}
    </div>
  );
}
export const TrendingChips = memo(TrendingChipsBase);
```

`top-viewed-list.tsx`:

```tsx
import { memo } from "react";
import type { ArticleVM } from "../types";

function TopViewedListBase({
  items, onOpen,
}: { items: ArticleVM[]; onOpen: (slug: string) => void }) {
  return (
    <div className="flex flex-col gap-[15px]">
      {items.map((a, i) => (
        <div
          key={a.id}
          onClick={() => onOpen(a.slug)}
          className="flex cursor-pointer items-start gap-[13px]"
        >
          <span
            className="min-w-[26px] font-display text-[26px] font-extrabold leading-none"
            style={{ color: a.color }}
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <div>
            <h5 className="mb-1 text-[13.5px] font-semibold leading-[1.32] text-fg">{a.title}</h5>
            <span className="font-mono text-[10.5px] text-muted">{a.dateLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
export const TopViewedList = memo(TopViewedListBase);
```

`sub-nav.tsx`:

```tsx
const META = "SỐ 128 · 12.07.2026 · CẬP NHẬT MỖI NGÀY";

export function SubNav() {
  return (
    <div className="flex items-center justify-between gap-5 border-b-2 border-fg bg-surface px-[30px] py-[11px]">
      <nav className="flex gap-[26px] text-[13.5px] font-semibold">
        <a href="/" className="text-fg no-underline">Trang chủ</a>
        <a href="/tags" className="text-muted no-underline">Danh mục</a>
        <a href="/" className="text-muted no-underline">Khám phá</a>
      </nav>
      <span className="font-mono text-[11px] tracking-[0.06em] text-muted">{META}</span>
    </div>
  );
}
```

`skeletons/article-row-skeleton.tsx`:

```tsx
export function ArticleRowSkeleton() {
  return (
    <div className="flex animate-pulse items-start gap-[18px] border-b border-line py-[19px]">
      <div className="h-[90px] w-[132px] flex-none rounded-lg bg-soft" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-24 rounded bg-soft" />
        <div className="h-5 w-3/4 rounded bg-soft" />
        <div className="h-3 w-full rounded bg-soft" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Test render `ArticleRow`**

Tạo `apps/web/src/features/magazine/components/article-row.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArticleRow } from "./article-row";
import type { ArticleVM } from "../types";

vi.mock("next/image", () => ({ default: (p: any) => <img alt={p.alt} /> }));

const vm: ArticleVM = {
  id: "a1", slug: "hoc-go", title: "Học Go", excerpt: "mô tả",
  category: "it", categoryLabel: "IT", color: "#2f6df6",
  date: "2026-07-12T00:00:00Z", dateLabel: "12/07/2026", readTime: "5 phút",
  coverImage: null, author: null, views: null, comments: null,
};

describe("ArticleRow", () => {
  it("hiện tiêu đề + read time; ẩn author/views/comments khi null", () => {
    render(<ArticleRow article={vm} index={0} saved={false} onToggleSave={() => {}} onOpen={() => {}} />);
    expect(screen.getByText("Học Go")).toBeInTheDocument();
    expect(screen.getByText("5 phút")).toBeInTheDocument();
    expect(screen.queryByText(/bình luận/)).not.toBeInTheDocument();
  });

  it("click sao gọi onToggleSave, không bubble sang onOpen", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(<ArticleRow article={vm} index={0} saved={false} onToggleSave={onToggle} onOpen={onOpen} />);
    fireEvent.click(screen.getByLabelText("Lưu bài viết"));
    expect(onToggle).toHaveBeenCalledWith("a1");
    expect(onOpen).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Chạy test — PASS**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/components/article-row.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/magazine/components
git commit -m "feat(web): component trình bày Mạch (memo) — article-row, rail-item, trending, top-viewed, sub-nav, skeleton"
```

---

## Task 6: Component tương tác + `MagazineBoard` island

**Files:**
- Create: `apps/web/src/features/magazine/components/search-bar.tsx`
- Create: `apps/web/src/features/magazine/components/auth-menu.tsx`
- Create: `apps/web/src/features/magazine/components/masthead.tsx`
- Create: `apps/web/src/features/magazine/components/category-rail.tsx`
- Create: `apps/web/src/features/magazine/components/newsletter-box.tsx`
- Create: `apps/web/src/features/magazine/components/article-list.tsx`
- Create: `apps/web/src/features/magazine/components/toast.tsx`
- Create: `apps/web/src/features/magazine/components/auth-modal.tsx`
- Create: `apps/web/src/features/magazine/components/magazine-board.tsx`
- Create + Test: `apps/web/src/features/magazine/components/magazine-board.test.tsx`

**Interfaces:**
- Consumes: store (`useMagazineStore`, `useSavedCount`), `useTheme`, lib `filterArticles`, `ArticleRow`, `CategoryRailItem`, `TrendingChips`, `TopViewedList`, `SubNav`, `localNewsletterService`, `CATEGORIES`.
- Produces: `MagazineBoard({ articles, topViewed }: { articles: ArticleVM[]; topViewed: ArticleVM[] })`.

- [ ] **Step 1: `search-bar.tsx`** (chỉ subscribe slice query → không re-render khi state khác đổi)

```tsx
"use client";
import { Search } from "lucide-react";
import { useMagazineStore } from "../store/magazine-store";

export function SearchBar() {
  const query = useMagazineStore((s) => s.query);
  const setQuery = useMagazineStore((s) => s.setQuery);
  return (
    <div className="flex max-w-[400px] flex-1 items-center gap-[9px] rounded-[9px] border border-white/35 bg-white/15 px-[15px] py-[10px]">
      <Search size={15} className="flex-none text-white" strokeWidth={2} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm bài viết, chủ đề, tác giả…"
        className="flex-1 border-none bg-transparent text-[13.5px] text-white outline-none placeholder:text-white/70"
      />
    </div>
  );
}
```

- [ ] **Step 2: `auth-menu.tsx`**

```tsx
"use client";
import { useMagazineStore, useSavedCount } from "../store/magazine-store";

export function AuthMenu() {
  const user = useMagazineStore((s) => s.user);
  const openAuth = useMagazineStore((s) => s.openAuth);
  const logout = useMagazineStore((s) => s.logout);
  const savedCount = useSavedCount();

  if (!user) {
    return (
      <div className="flex items-center gap-[9px]">
        <button onClick={() => openAuth("login")} className="rounded-lg border border-white/40 bg-white/15 px-[14px] py-[9px] text-[12.5px] font-semibold text-white">Đăng nhập</button>
        <button onClick={() => openAuth("register")} className="rounded-lg bg-white px-[14px] py-[9px] text-[12.5px] font-bold text-accent">Đăng ký</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-[11px]">
      <span className="rounded-lg border border-white/40 bg-white/15 px-[13px] py-[9px] text-[12.5px] font-bold text-white">Đã lưu {savedCount}</span>
      <div className="flex items-center gap-2">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-[13px] font-bold text-accent">{user.name.charAt(0).toUpperCase()}</span>
        <span className="text-[13px] font-semibold text-white">{user.name}</span>
      </div>
      <button onClick={logout} className="rounded-lg border border-white/40 px-[12px] py-[9px] text-[12px] text-white">Thoát</button>
    </div>
  );
}
```

- [ ] **Step 3: `masthead.tsx`** (dark toggle qua useTheme)

```tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/use-theme";
import { SearchBar } from "./search-bar";
import { AuthMenu } from "./auth-menu";

export function Masthead() {
  const { dark, toggle } = useTheme();
  return (
    <div className="flex items-center justify-between gap-[22px] bg-accent px-[30px] py-5 text-white">
      <div className="flex items-baseline gap-[14px]">
        <span className="font-display text-[34px] font-extrabold leading-[0.9] tracking-[-0.03em]">Mạch</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-85">Tạp chí tri thức</span>
      </div>
      <SearchBar />
      <div className="flex items-center gap-[10px]">
        <button onClick={toggle} aria-label="Đổi giao diện sáng/tối" className="flex items-center gap-[7px] rounded-lg border border-white/35 bg-white/15 px-[13px] py-[9px] text-[12.5px] font-semibold text-white">
          {dark ? <Sun size={13} /> : <Moon size={13} />}
          {dark ? "Sáng" : "Tối"}
        </button>
        <AuthMenu />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `category-rail.tsx`** (đọc cat, render item memo)

```tsx
"use client";
import { CATEGORIES } from "../categories";
import { useMagazineStore } from "../store/magazine-store";
import { CategoryRailItem } from "./category-rail-item";
import { NewsletterBox } from "./newsletter-box";

export function CategoryRail() {
  const cat = useMagazineStore((s) => s.cat);
  const setCat = useMagazineStore((s) => s.setCat);
  return (
    <nav className="w-[224px] flex-none border-r border-line bg-surface px-[18px] py-6">
      <div className="mx-[6px] mb-[13px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Lĩnh vực</div>
      <div className="flex flex-col gap-1">
        {CATEGORIES.map((c) => (
          <CategoryRailItem key={c.key} category={c} active={c.key === cat} onSelect={setCat} />
        ))}
      </div>
      <NewsletterBox variant="rail" />
    </nav>
  );
}
```

- [ ] **Step 5: `newsletter-box.tsx`** (state cục bộ, không đụng store toàn cục)

```tsx
"use client";
import { useState } from "react";
import { useMagazineStore } from "../store/magazine-store";
import { localNewsletterService } from "../services/newsletter-service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterBox({ variant }: { variant: "rail" | "footer" }) {
  const [email, setEmail] = useState("");
  const setToast = useMagazineStore((s) => s.setToast);

  const submit = async () => {
    if (!EMAIL_RE.test(email)) return setToast("Email không hợp lệ.");
    await localNewsletterService.subscribe(email);
    setEmail("");
    setToast("Đăng ký bản tin thành công!");
  };

  if (variant === "rail") {
    return (
      <div className="mt-7 rounded-xl bg-fg p-[18px] text-bg">
        <div className="mb-[5px] font-display text-[16px] font-bold leading-[1.15]">Bản tin Mạch</div>
        <p className="mb-3 text-[11.5px] leading-[1.5] opacity-70">Tuyển tập hay nhất, mỗi sáng thứ Hai.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email…" className="mb-2 w-full rounded-lg border-none px-3 py-[10px] text-[12.5px] text-fg outline-none" />
        <button onClick={submit} className="w-full rounded-lg bg-accent py-[10px] text-[12.5px] font-bold text-white">Đăng ký</button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email…" className="min-w-0 flex-1 rounded-lg border-none px-3 py-[11px] text-[12.5px] text-fg outline-none" />
      <button onClick={submit} className="whitespace-nowrap rounded-lg bg-accent px-[15px] py-[11px] text-[12.5px] font-bold text-white">OK</button>
    </div>
  );
}
```

- [ ] **Step 6: `article-list.tsx`** (useDeferredValue + useMemo + memo rows)

```tsx
"use client";
import { useDeferredValue, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMagazineStore } from "../store/magazine-store";
import { filterArticles } from "../lib/filter";
import { ArticleRow } from "./article-row";
import type { ArticleVM } from "../types";

export function ArticleList({ articles }: { articles: ArticleVM[] }) {
  const router = useRouter();
  const query = useMagazineStore((s) => s.query);
  const cat = useMagazineStore((s) => s.cat);
  const saved = useMagazineStore((s) => s.saved);
  const toggleSave = useMagazineStore((s) => s.toggleSave);

  const deferredQuery = useDeferredValue(query);
  const isStale = deferredQuery !== query;
  const visible = useMemo(
    () => filterArticles(articles, deferredQuery, cat),
    [articles, deferredQuery, cat],
  );

  return (
    <main className="min-w-0 flex-1 px-[26px] py-6">
      <div className="mb-[18px] flex items-baseline justify-between">
        <h2 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">
          <span className="bg-[linear-gradient(transparent_58%,var(--highlight)_58%)] px-[2px]">Mới nhất</span>
        </h2>
        <span className="font-mono text-[11px] text-muted">{visible.length} kết quả</span>
      </div>
      <div className={`flex flex-col transition-opacity ${isStale ? "opacity-60" : ""}`}>
        {visible.map((a, i) => (
          <ArticleRow
            key={a.id}
            article={a}
            index={i}
            saved={Boolean(saved[a.id])}
            onToggleSave={toggleSave}
            onOpen={(slug) => router.push(`/blog/${slug}`)}
          />
        ))}
        {visible.length === 0 && (
          <p className="py-16 text-center text-muted">Không tìm thấy bài viết phù hợp.</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 7: `toast.tsx`** (bottom-center, auto-hide 2.8s)

```tsx
"use client";
import { useEffect } from "react";
import { useMagazineStore } from "../store/magazine-store";

export function Toast() {
  const toast = useMagazineStore((s) => s.toast);
  const clearToast = useMagazineStore((s) => s.clearToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clearToast, 2800);
    return () => clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;
  return (
    <div role="alert" className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-fg px-5 py-3 text-[13px] font-semibold text-bg shadow-modal">
      {toast}
    </div>
  );
}
```

- [ ] **Step 8: `auth-modal.tsx`** (validate cục bộ, MOCK — sẽ nối auth thật sau)

```tsx
"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { useMagazineStore } from "../store/magazine-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// MOCK auth: chỉ validate + set user cục bộ. TODO: nối Firebase/Go core BFF.
export function AuthModal() {
  const mode = useMagazineStore((s) => s.authMode);
  const close = useMagazineStore((s) => s.closeAuth);
  const openAuth = useMagazineStore((s) => s.openAuth);
  const login = useMagazineStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const isRegister = mode === "register";

  const submit = () => {
    if (!EMAIL_RE.test(email)) return setMsg("Email không hợp lệ.");
    if (!pass) return setMsg("Vui lòng nhập mật khẩu.");
    const displayName = isRegister ? name.trim() || email.split("@")[0] : email.split("@")[0];
    login({ name: displayName, email });
  };

  return (
    <div onClick={close} className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(8,12,22,0.55)] p-5">
      <div onClick={(e) => e.stopPropagation()} className="w-[384px] max-w-full rounded-[14px] bg-surface p-[30px] text-fg shadow-modal">
        <div className="mb-[6px] flex items-start justify-between">
          <h3 className="m-0 font-display text-[24px] font-extrabold tracking-[-0.02em]">{isRegister ? "Đăng ký" : "Đăng nhập"}</h3>
          <button onClick={close} aria-label="Đóng" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-soft text-muted"><X size={17} /></button>
        </div>
        <p className="mb-5 text-[13px] leading-[1.5] text-muted">{isRegister ? "Tạo tài khoản để lưu bài và nhận bản tin." : "Đăng nhập để lưu bài viết yêu thích."}</p>
        {isRegister && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên hiển thị" className="mb-[11px] w-full rounded-[9px] border border-line bg-bg px-[14px] py-3 text-[13.5px] text-fg outline-none" />
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mb-[11px] w-full rounded-[9px] border border-line bg-bg px-[14px] py-3 text-[13.5px] text-fg outline-none" />
        <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Mật khẩu" className="mb-[11px] w-full rounded-[9px] border border-line bg-bg px-[14px] py-3 text-[13.5px] text-fg outline-none" />
        {msg && <p className="mb-3 text-[12.5px] font-semibold text-accent">{msg}</p>}
        <button onClick={submit} className="mb-[15px] w-full rounded-[9px] bg-accent py-[13px] text-[14px] font-bold text-white">{isRegister ? "Đăng ký" : "Đăng nhập"}</button>
        <div className="text-center text-[13px] text-muted">
          {isRegister ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <button onClick={() => { setMsg(""); openAuth(isRegister ? "login" : "register"); }} className="font-bold text-accent">{isRegister ? "Đăng nhập" : "Đăng ký"}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: `magazine-board.tsx`** (island root; auth-modal lazy)

```tsx
"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "../categories";
import { useMagazineStore } from "../store/magazine-store";
import { Masthead } from "./masthead";
import { SubNav } from "./sub-nav";
import { CategoryRail } from "./category-rail";
import { ArticleList } from "./article-list";
import { TrendingChips } from "./trending-chips";
import { TopViewedList } from "./top-viewed-list";
import { Toast } from "./toast";
import type { ArticleVM } from "../types";

const AuthModal = dynamic(() => import("./auth-modal").then((m) => m.AuthModal), { ssr: false });

const TRENDING = CATEGORIES.filter((c) => ["ai", "it", "finance", "growth", "culture"].includes(c.key));

export function MagazineBoard({ articles, topViewed }: { articles: ArticleVM[]; topViewed: ArticleVM[] }) {
  const router = useRouter();
  const authOpen = useMagazineStore((s) => s.authOpen);
  const setCat = useMagazineStore((s) => s.setCat);

  return (
    <>
      <Masthead />
      <SubNav />
      <div className="mx-auto flex max-w-shell">
        <CategoryRail />
        <ArticleList articles={articles} />
        <aside className="w-[250px] flex-none border-l border-line bg-surface px-[22px] py-6">
          <div className="mb-[14px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Thịnh hành</div>
          <TrendingChips categories={TRENDING} onSelect={setCat} />
          <div className="mb-[14px] font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Top xem nhiều</div>
          <TopViewedList items={topViewed} onOpen={(slug) => router.push(`/blog/${slug}`)} />
          <a href="/" className="mt-[26px] block rounded-[9px] bg-accent py-3 text-center text-[13px] font-bold text-white no-underline">Tham gia nhóm Facebook →</a>
        </aside>
      </div>
      <Toast />
      {authOpen && <AuthModal />}
    </>
  );
}
```

- [ ] **Step 10: Test tích hợp `MagazineBoard`**

Tạo `apps/web/src/features/magazine/components/magazine-board.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MagazineBoard } from "./magazine-board";
import { useMagazineStore } from "../store/magazine-store";
import type { ArticleVM } from "../types";

vi.mock("next/image", () => ({ default: (p: any) => <img alt={p.alt} /> }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const mk = (id: string, title: string, cat: ArticleVM["category"]): ArticleVM => ({
  id, slug: id, title, excerpt: "", category: cat, categoryLabel: cat.toUpperCase(),
  color: "#000", date: "", dateLabel: "01/01/2026", readTime: "1 phút",
  coverImage: null, author: null, views: null, comments: null,
});
const articles = [mk("1", "Học Go", "it"), mk("2", "Mạng nơ-ron", "ai")];

beforeEach(() => {
  push.mockClear();
  useMagazineStore.setState({ query: "", cat: "all", saved: {}, user: null, authOpen: false, authMode: "login", toast: null });
});

describe("MagazineBoard", () => {
  it("render toàn bộ bài mặc định", () => {
    render(<MagazineBoard articles={articles} topViewed={articles} />);
    expect(screen.getByText("Học Go")).toBeInTheDocument();
    expect(screen.getByText("Mạng nơ-ron")).toBeInTheDocument();
  });

  it("search lọc danh sách", () => {
    render(<MagazineBoard articles={articles} topViewed={articles} />);
    fireEvent.change(screen.getByPlaceholderText(/Tìm bài viết/), { target: { value: "go" } });
    expect(screen.getByText("Học Go")).toBeInTheDocument();
    expect(screen.queryByText("Mạng nơ-ron")).not.toBeInTheDocument();
  });

  it("lưu khi chưa login → mở auth modal", () => {
    render(<MagazineBoard articles={articles} topViewed={articles} />);
    fireEvent.click(screen.getAllByLabelText("Lưu bài viết")[0]);
    expect(useMagazineStore.getState().authOpen).toBe(true);
  });
});
```

- [ ] **Step 11: Chạy test — PASS**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/magazine/components/magazine-board.test.tsx`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/features/magazine/components
git commit -m "feat(web): component tương tác + MagazineBoard island (search/filter/dark/bookmark/auth/newsletter)"
```

---

## Task 7: Chrome toàn site + wire `app/page.tsx` + footer + loading

**Files:**
- Create: `apps/web/src/features/magazine/components/magazine-footer.tsx`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/loading.tsx`

**Interfaces:**
- Consumes: `MagazineBoard`, `postsToArticleVMs`, `listAllPublished`, `NewsletterBox`, `THEME_SCRIPT`, `CATEGORIES`.
- Produces: `MagazineFooter()`.

- [ ] **Step 1: `magazine-footer.tsx`**

```tsx
import { CATEGORIES } from "../categories";
import { NewsletterBox } from "./newsletter-box";

const SOCIAL = ["f", "in", "X", "YT"];

export function MagazineFooter() {
  return (
    <footer className="bg-fg px-[30px] pb-6 pt-[46px] text-bg">
      <div className="mx-auto grid max-w-shell grid-cols-[1.7fr_1fr_1fr_1.3fr] gap-[38px] border-b border-white/15 pb-8">
        <div>
          <div className="mb-[11px] font-display text-[27px] font-extrabold tracking-[-0.03em]">Mạch</div>
          <p className="mb-[18px] max-w-[290px] text-[13px] leading-[1.65] opacity-70">Tạp chí tri thức cho người trẻ dám nghĩ — công nghệ, tài chính, kiến trúc, văn hoá và những gì đáng đọc mỗi ngày.</p>
          <div className="flex gap-[9px]">
            {SOCIAL.map((s) => (
              <a key={s} href="/" className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-white/10 text-[13px] font-bold text-bg no-underline">{s}</a>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] opacity-50">Chuyên mục</div>
          <div className="flex flex-col gap-[10px]">
            {CATEGORIES.filter((c) => c.key !== "all").slice(0, 6).map((c) => (
              <a key={c.key} href="/tags" className="text-[13px] text-bg no-underline opacity-70">{c.label}</a>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] opacity-50">Về Mạch</div>
          <div className="flex flex-col gap-[10px] text-[13px]">
            {["Giới thiệu", "Viết cho Mạch", "Liên hệ", "Tuyển dụng"].map((t) => (
              <a key={t} href="/" className="text-bg no-underline opacity-70">{t}</a>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-[15px] font-mono text-[10px] uppercase tracking-[0.16em] opacity-50">Bản tin</div>
          <p className="mb-3 text-[12.5px] leading-[1.55] opacity-70">Bài hay nhất mỗi sáng thứ Hai.</p>
          <NewsletterBox variant="footer" />
        </div>
      </div>
      <div className="mx-auto flex max-w-shell flex-wrap justify-between gap-[10px] pt-5 font-mono text-[11px] opacity-50">
        <span>© 2026 Mạch. Bảo lưu mọi quyền.</span>
        <span>Điều khoản · Bảo mật · Cookie</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Cập nhật `layout.tsx`** (font mới + theme script + footer mới; bỏ SiteHeader/SiteFooter cũ — masthead do trang tự render vì cần dữ liệu/tương tác)

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Be_Vietnam_Pro, Space_Mono } from "next/font/google";
import "./globals.css";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import { MagazineFooter } from "@/features/magazine/components/magazine-footer";
import { THEME_SCRIPT } from "@/features/magazine/hooks/use-theme";

const display = Bricolage_Grotesque({ subsets: ["latin", "vietnamese"], weight: ["700", "800"], variable: "--font-display-next", display: "swap" });
const sans = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-sans-next", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono-next", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "Mạch — tạp chí tri thức cho người trẻ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-bg text-fg">
        <div className="flex-1">{children}</div>
        <MagazineFooter />
      </body>
    </html>
  );
}
```

> Ghi chú: masthead (cần tương tác) render trong trang chủ qua `MagazineBoard`. Các trang khác (`/blog/[slug]`, `/tags`) tạm thời không có masthead — sẽ bổ sung chrome dùng chung ở slice sau (ngoài phạm vi). Footer đủ làm chrome chung ngay.

- [ ] **Step 3: Cập nhật `page.tsx`** (server fetch + adapt + board)

```tsx
import { listAllPublished } from "@/features/posts/api";
import { postsToArticleVMs } from "@/features/magazine/lib/article-vm";
import { MagazineBoard } from "@/features/magazine/components/magazine-board";

export const revalidate = 60;

export default async function HomePage() {
  const posts = await listAllPublished();
  const articles = postsToArticleVMs(posts);
  // Top xem nhiều: backend chưa có `views` → tạm lấy 5 bài mới nhất.
  const topViewed = articles.slice(0, 5);
  return <MagazineBoard articles={articles} topViewed={topViewed} />;
}
```

- [ ] **Step 4: `loading.tsx`**

```tsx
import { ArticleRowSkeleton } from "@/features/magazine/components/skeletons/article-row-skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-shell px-[26px] py-10">
      <div className="mb-[18px] h-8 w-40 animate-pulse rounded bg-soft" />
      {Array.from({ length: 6 }).map((_, i) => (
        <ArticleRowSkeleton key={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + toàn bộ test**

Run: `pnpm --filter @ultimate/web exec tsc --noEmit && pnpm --filter @ultimate/web test`
Expected: PASS (typecheck 0 lỗi; toàn bộ test xanh).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/page.tsx apps/web/src/app/loading.tsx apps/web/src/features/magazine/components/magazine-footer.tsx
git commit -m "feat(web): wire trang chủ Mạch — server fetch + board + footer chrome + loading"
```

---

## Task 8: Seed data + cấu hình ảnh + docs

**Files:**
- Create: `services/core/seed/seed_articles.sql`
- Modify: `apps/web/next.config.mjs`
- Modify: `README.md`, `services/core/README.md`

**Interfaces:** không có (data + config).

- [ ] **Step 1: Viết `services/core/seed/seed_articles.sql`**

Tạo file với tags + posts + post_tags idempotent. Ảnh dùng `picsum.photos` (ổn định, deterministic theo slug). Ví dụ đủ 10 tag + 12 bài (mỗi bài `content_html` vài đoạn thật):

```sql
-- Seed idempotent cho trang chủ Mạch. Chạy lại an toàn (ON CONFLICT DO NOTHING).
-- Cách chạy: docker compose exec -T postgres psql -U blog -d blog < services/core/seed/seed_articles.sql

INSERT INTO tags (name, slug) VALUES
  ('IT','it'), ('AI','ai'), ('Tài chính','finance'), ('Chứng khoán','stock'),
  ('Kiến trúc','arch'), ('Văn hóa','culture'), ('Giải trí','ent'),
  ('Tin tức','news'), ('Phát triển bản thân','growth'), ('Review sách','book')
ON CONFLICT (slug) DO NOTHING;

WITH seed(title, slug, excerpt, cover, cat, days) AS (
  VALUES
    ('Vì sao Go trở thành lựa chọn số 1 cho backend hiện đại','vi-sao-go-backend','Goroutine, tooling và trải nghiệm deploy khiến Go bứt phá.','it', 1),
    ('RAG là gì và tại sao nó thay đổi cách ta xây chatbot','rag-la-gi','Retrieval-Augmented Generation kết hợp truy hồi và sinh văn bản.','ai', 2),
    ('Lãi kép: kỳ quan thứ tám của thế giới đầu tư','lai-kep-ky-quan','Hiểu đúng lãi kép để tiền làm việc thay bạn.','finance', 3),
    ('Đọc bảng giá chứng khoán cho người mới bắt đầu','doc-bang-gia-ck','Khớp lệnh, dư mua dư bán và những con số cần nhìn.','stock', 4),
    ('Kiến trúc nhiệt đới: sống cùng khí hậu thay vì chống lại','kien-truc-nhiet-doi','Thông gió tự nhiên và vật liệu bản địa.','arch', 5),
    ('Cà phê Việt và hành trình từ nông trại tới thế giới','ca-phe-viet','Câu chuyện văn hoá sau mỗi tách cà phê.','culture', 6),
    ('Điện ảnh Việt 2026: làn sóng đạo diễn trẻ','dien-anh-viet-2026','Những gương mặt định hình phòng vé năm nay.','ent', 7),
    ('Tổng hợp công nghệ tuần: chip mới, mã nguồn mở và AI','tong-hop-cong-nghe-tuan','Điểm tin nhanh những gì đáng chú ý.','news', 8),
    ('Kỷ luật hơn động lực: xây thói quen bền vững','ky-luat-hon-dong-luc','Vì sao hệ thống thắng mục tiêu.','growth', 9),
    ('Review "Thinking, Fast and Slow" — hai hệ tư duy','review-thinking-fast-slow','Daniel Kahneman và cách bộ não ra quyết định.','book', 10),
    ('TypeScript nâng cao: type-level programming thực chiến','ts-nang-cao','Conditional types, template literal types và hơn thế.','it', 11),
    ('Prompt engineering: nói chuyện với mô hình sao cho hiệu quả','prompt-engineering','Cấu trúc prompt, few-shot và ràng buộc đầu ra.','ai', 12)
)
INSERT INTO posts (title, slug, content_html, content_json, excerpt, cover_image, status, published_at, created_at, updated_at)
SELECT
  s.title, s.slug,
  '<p>' || s.excerpt || '</p><h2>Mở đầu</h2><p>Đây là nội dung mẫu cho bài viết trên tạp chí Mạch, đủ dài để tính thời gian đọc và hiển thị ở trang chi tiết. '
    || repeat('Chúng ta cùng đi sâu vào chủ đề này qua các ví dụ thực tế và góc nhìn dễ hiểu. ', 12)
    || '</p><h2>Kết</h2><p>Cảm ơn bạn đã đọc tới đây.</p>',
  '{}'::jsonb,
  s.excerpt,
  'https://picsum.photos/seed/' || s.slug || '/528/360',
  'PUBLISHED',
  now() - (s.days || ' days')::interval,
  now() - (s.days || ' days')::interval,
  now() - (s.days || ' days')::interval
FROM seed s
ON CONFLICT (slug) DO NOTHING;

-- Nối mỗi bài với đúng 1 category chính.
INSERT INTO post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM posts p
JOIN (VALUES
  ('vi-sao-go-backend','it'),('rag-la-gi','ai'),('lai-kep-ky-quan','finance'),
  ('doc-bang-gia-ck','stock'),('kien-truc-nhiet-doi','arch'),('ca-phe-viet','culture'),
  ('dien-anh-viet-2026','ent'),('tong-hop-cong-nghe-tuan','news'),
  ('ky-luat-hon-dong-luc','growth'),('review-thinking-fast-slow','book'),
  ('ts-nang-cao','it'),('prompt-engineering','ai')
) m(pslug, tslug) ON m.pslug = p.slug
JOIN tags t ON t.slug = m.tslug
ON CONFLICT (post_id, tag_id) DO NOTHING;
```

- [ ] **Step 2: Cho phép host ảnh seed trong `next.config.mjs`**

Sửa mảng `imgSrc` và `remotePatterns` để thêm `picsum.photos` (+ `fastly.picsum.photos` mà picsum redirect tới). Thay khối `imgSrc` và `images`:

```js
const imgSrc = [
  "'self'", "data:",
  "https://picsum.photos", "https://fastly.picsum.photos",
  mediaHost ? `https://${mediaHost}` : "",
].filter(Boolean).join(" ");
```

và trong `images.remotePatterns` thêm 2 entry đầu mảng:

```js
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      ...(isProd ? [] : [{ protocol: "http", hostname: "localhost" }]),
      ...(mediaHost ? [{ protocol: "https", hostname: mediaHost }] : []),
    ],
```

- [ ] **Step 3: Chạy seed vào Postgres**

Run: `docker compose exec -T postgres psql -U blog -d blog < services/core/seed/seed_articles.sql`
Expected: các dòng `INSERT 0 N` (N>0 lần đầu; chạy lại → `INSERT 0 0`, không lỗi).

Kiểm chứng: `docker compose exec -T postgres psql -U blog -d blog -c "select count(*) from posts where status='PUBLISHED';"` → ≥ 12.

- [ ] **Step 4: Ghi lệnh seed vào docs**

Thêm vào `README.md` (dưới mục migration) và `services/core/README.md`:

```markdown
### Seed dữ liệu mẫu (trang chủ "sống")

Chèn ~12 bài PUBLISHED phủ nhiều category (idempotent):

    docker compose exec -T postgres psql -U blog -d blog < services/core/seed/seed_articles.sql
```

- [ ] **Step 5: Commit**

```bash
git add services/core/seed/seed_articles.sql apps/web/next.config.mjs README.md services/core/README.md
git commit -m "feat: seed dữ liệu mẫu Mạch + cho phép host ảnh picsum + docs"
```

---

## Task 9: Verify E2E + build + dọn dẹp + cập nhật tiến độ

**Files:**
- Modify: `CLAUDE.md`
- (Có thể) Delete: `apps/web/src/components/site-header.tsx`, `site-footer.tsx` nếu không còn tham chiếu.

- [ ] **Step 1: Kiểm tra tham chiếu SiteHeader/SiteFooter cũ**

Run: `grep -rn "site-header\|site-footer\|SiteHeader\|SiteFooter" apps/web/src`
Expected: chỉ còn định nghĩa file; nếu không nơi nào import → xoá 2 file. Nếu `/blog/[slug]` hay `/tags` từng import → giữ lại và để nguyên các trang đó.

- [ ] **Step 2: Build production**

Run: `pnpm --filter @ultimate/web build`
Expected: build thành công; `/` là route ISR/prerender. Không lỗi CSP/font/image.

- [ ] **Step 3: Verify E2E bằng skill `verify`**

Bật core (`cd services/core && go run ./cmd/api`) + web (`pnpm --filter @ultimate/web start`) rồi dùng skill `superpowers` verify / browser để kiểm:
- Trang chủ hiện masthead xanh, rail category, feed 12 bài có thumbnail picsum, sidebar top-viewed.
- Search "go" → lọc còn bài Go; chọn category AI ở rail → chỉ bài AI.
- Toggle Tối/Sáng → đổi theme, reload giữ nguyên (localStorage).
- Bấm ★ khi chưa login → mở modal + toast "Đăng nhập để lưu…"; đăng nhập mock → ★ lưu được, header "Đã lưu N".
- Click 1 bài → điều hướng `/blog/[slug]` (trang detail cũ vẫn hoạt động).
- Newsletter nhập email hợp lệ → toast thành công.

Ghi lại kết quả (ảnh chụp nếu có).

- [ ] **Step 4: Cập nhật `CLAUDE.md`**

Thêm mục Slice 6 vào "Trạng thái hiện tại" + cập nhật dòng "📍 Điểm hiện tại": Phase 1 + Slice 5* DONE, **Slice 6 DONE (trang chủ Mạch UI/UX)**; nêu rõ backend consumer (auth/bookmark/newsletter thật) và redesign trang detail/tags còn ở phía trước; link spec + plan slice 6.

- [ ] **Step 5: Commit + đóng nhánh**

```bash
git add CLAUDE.md apps/web/src/components
git commit -m "docs: Slice 6 DONE — trang chủ Mạch UI/UX; verify E2E"
```

Sau đó dùng skill `superpowers:finishing-a-development-branch` để chọn merge/PR.

---

## Self-Review (đã rà)

- **Spec coverage:** §2 kiến trúc→T7; §3 re-render→T5/T6 (memo, useDeferredValue, selector); §4 tokens/font→T1; §5 adapter→T2; §6 cấu trúc→toàn bộ; §7 tương tác→T3/T6; §8 perf/lazy/skeleton→T5/T6/T7; §9 chrome→T7; §10 categories→T1; §11 test→T2/T3/T4/T5/T6; §12 seed→T8; §13 rủi ro→T8 (ảnh fallback), T9 (không hồi quy). Đủ.
- **Placeholder scan:** không có TBD/TODO thực thi (chỉ TODO-comment đánh dấu mock auth/newsletter — có chủ đích, khớp spec).
- **Type consistency:** `ArticleVM`, `CategoryKey`, `MockUser` dùng nhất quán; store actions (`toggleSave/login/logout/openAuth/closeAuth/setToast/clearToast/setQuery/setCat`) khớp giữa T3 và T6; `postToArticleVM/postsToArticleVMs`, `filterArticles`, `formatViews/formatDate/readTimeFromHtml` khớp signature giữa T2 và nơi dùng.
