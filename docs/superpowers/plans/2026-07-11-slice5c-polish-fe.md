# Slice 5c — Polish FE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish FE — SEO đầy đủ (W3–W6), sanitize + CSP giữ SSG (W7), `next/font`, và siết type-safety + sửa lỗi nhỏ admin (A5–A9 + low).

**Architecture:** Web (Next.js): thêm metadata/JSON-LD/error pages, rehype-sanitize server-side + CSP header không-nonce (giữ SSG+ISR của 5b), migrate `next/font`. Admin (React): tightening TS + a11y + correctness. Không đụng DB (nhóm B → Slice 5d).

**Tech Stack:** Next.js 14 App Router; unified/rehype-sanitize; next/font; React 18 + TanStack Router/Query; Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-slice5c-polish-fe-design.md`.
- **CSP KHÔNG dùng nonce** — route web phải giữ static (`next build` cho `○`/`●`, không `ƒ`).
- Sanitize allowlist phải chặn `javascript:` protocol + `on*` handler nhưng giữ table/task-list/`<mark>`/img/code.
- Deps web thêm: `rehype-parse`, `rehype-sanitize`, `rehype-stringify`, `unified` (không thêm dep nào khác).
- Comment tiếng Việt theo phong cách file hiện có.
- Test: web `pnpm --filter @ultimate/web test`; admin `pnpm --filter @ultimate/admin test`. Build: `pnpm --filter @ultimate/web build`, `pnpm --filter @ultimate/admin build`.
- Sau khi xong TẤT CẢ tasks (Task 12): đánh dấu `✅ RESOLVED` W3–W7 + low SEO + A5–A9 + admin low trong review doc + cập nhật CLAUDE.md.

---

### Task 1: Web — RSS enrich + sitemap/rss throw (W3 + low RSS)

**Files:**
- Modify: `apps/web/src/features/posts/rss.ts`
- Test: `apps/web/src/features/posts/rss.test.ts`
- Modify: `apps/web/src/app/sitemap.ts`, `apps/web/src/app/rss.xml/route.ts`

**Interfaces:**
- Produces: `buildRssXml(posts, siteUrl, siteName)` output chứa `xmlns:atom`, `<atom:link rel="self">`, `<language>vi</language>`, `<lastBuildDate>` (khi có bài), và escape URL trong `<link>`/`<guid>`.

- [ ] **Step 1: Write failing tests** — thêm vào `apps/web/src/features/posts/rss.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRssXml } from "./rss";
import type { Post } from "@ultimate/types";

const post = (over: Partial<Post> = {}): Post =>
  ({
    id: "x", title: "T&T", slug: "a&b", content_json: {}, content_html: "",
    excerpt: "e", cover_image: null, status: "PUBLISHED", meta_title: null,
    meta_desc: null, published_at: "2026-07-01T00:00:00Z", tags: [],
    created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z", ...over,
  }) as unknown as Post;

describe("buildRssXml (enrich)", () => {
  const xml = buildRssXml([post()], "https://site.test", "Site");
  it("có atom self-link + namespace", () => {
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain('<atom:link rel="self" href="https://site.test/rss.xml"');
  });
  it("có language vi", () => expect(xml).toContain("<language>vi</language>"));
  it("có lastBuildDate khi có bài", () => expect(xml).toContain("<lastBuildDate>"));
  it("escape URL trong link/guid", () =>
    expect(xml).toContain("https://site.test/blog/a&amp;b"));
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/rss.test.ts`
Expected: FAIL (chưa có atom/language/escape url).

- [ ] **Step 3: Implement** — thay `apps/web/src/features/posts/rss.ts`:

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
      const link = escapeXml(`${siteUrl}/blog/${p.slug}`);
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

  const latest = posts.find((p) => p.published_at)?.published_at;
  const lastBuild = latest ? new Date(latest).toUTCString() : "";

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(siteName)}</title>`,
    `    <link>${escapeXml(siteUrl)}</link>`,
    `    <atom:link rel="self" href="${escapeXml(siteUrl + "/rss.xml")}" type="application/rss+xml" />`,
    `    <description>${escapeXml(siteName)}</description>`,
    "    <language>vi</language>",
    lastBuild ? `    <lastBuildDate>${lastBuild}</lastBuildDate>` : "",
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
```

- [ ] **Step 4: Run — verify pass**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/rss.test.ts`
Expected: PASS.

- [ ] **Step 5: W3 — bỏ catch ở sitemap + rss route**

Trong `apps/web/src/app/sitemap.ts`: bỏ `.catch(() => [])` quanh lời gọi `listAllPublished()` (để lỗi throw). Tương tự `apps/web/src/app/rss.xml/route.ts`. (Giữ nguyên phần còn lại.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/posts/rss.ts apps/web/src/features/posts/rss.test.ts apps/web/src/app/sitemap.ts apps/web/src/app/rss.xml/route.ts
git commit -m "feat(web): RSS atom-self/language/lastBuildDate + escape url; sitemap/rss throw khi core down (W3)"
```

---

### Task 2: Web — OG image fallback + twitter card (low SEO)

**Files:**
- Modify: `apps/web/src/features/posts/metadata.ts`
- Test: `apps/web/src/features/posts/metadata.test.ts`
- Create: `apps/web/public/og-default.png` (placeholder 1200×630)

**Interfaces:**
- Produces: `buildPostMetadata(post)` — khi `cover_image` null → `openGraph.images = [{ url: ${SITE_URL}/og-default.png }]` và `twitter.card = "summary"`; khi có ảnh → `summary_large_image`.

- [ ] **Step 1: Write failing tests** — thêm vào `apps/web/src/features/posts/metadata.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPostMetadata } from "./metadata";
import type { Post } from "@ultimate/types";

const base = (over: Partial<Post> = {}): Post =>
  ({
    id: "x", title: "T", slug: "s", content_json: {}, content_html: "",
    excerpt: "e", cover_image: null, status: "PUBLISHED", meta_title: null,
    meta_desc: null, published_at: null, tags: [],
    created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z", ...over,
  }) as unknown as Post;

describe("buildPostMetadata OG fallback", () => {
  it("không cover → og-default + twitter summary", () => {
    const m = buildPostMetadata(base({ cover_image: null }));
    expect(JSON.stringify(m.openGraph?.images)).toContain("/og-default.png");
    expect(m.twitter?.card).toBe("summary");
  });
  it("có cover → dùng cover + summary_large_image", () => {
    const m = buildPostMetadata(base({ cover_image: "https://cdn/x.png" }));
    expect(JSON.stringify(m.openGraph?.images)).toContain("https://cdn/x.png");
    expect(m.twitter?.card).toBe("summary_large_image");
  });
});
```

- [ ] **Step 2: Run — verify fail**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/metadata.test.ts`
Expected: FAIL (hiện `twitter.card` luôn `summary_large_image`; images undefined khi null).

- [ ] **Step 3: Implement** — sửa `apps/web/src/features/posts/metadata.ts`:

```ts
export function buildPostMetadata(post: Post): Metadata {
  const title = post.meta_title ?? post.title;
  const description = post.meta_desc ?? post.excerpt ?? "";
  const url = `${SITE_URL}/blog/${post.slug}`;
  const hasCover = Boolean(post.cover_image);
  const ogImage = post.cover_image ?? `${SITE_URL}/og-default.png`;
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
      images: [{ url: ogImage }],
    },
    twitter: {
      card: hasCover ? "summary_large_image" : "summary",
      title,
      description,
      images: [ogImage],
    },
  };
}
```

- [ ] **Step 4: Tạo placeholder** `apps/web/public/og-default.png` — ảnh PNG 1200×630 nền tối wordmark "Ultimate website" (nếu không có công cụ tạo ảnh, tạo file PNG tối giản bằng 1x1 rồi ghi TODO thay ảnh thật; miễn route `/og-default.png` không 404).

- [ ] **Step 5: Run — verify pass**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/metadata.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/posts/metadata.ts apps/web/src/features/posts/metadata.test.ts apps/web/public/og-default.png
git commit -m "feat(web): OG image fallback + twitter card theo có/không cover (low SEO)"
```

---

### Task 3: Web — tag pages metadata (W4)

**Files:**
- Modify: `apps/web/src/app/tags/[slug]/page.tsx`, `apps/web/src/app/tags/[slug]/page/[n]/page.tsx`, `apps/web/src/app/tags/page.tsx`

**Interfaces:**
- Consumes: `SITE_URL` (`@/lib/config`).

- [ ] **Step 1: `/tags/[slug]` generateMetadata** — thêm vào `apps/web/src/app/tags/[slug]/page.tsx` (import `Metadata` + `SITE_URL`):

```tsx
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return {
    title: `#${params.slug}`,
    description: `Các bài viết về chủ đề #${params.slug}.`,
    alternates: { canonical: `${SITE_URL}/tags/${params.slug}` },
  };
}
```

- [ ] **Step 2: `/tags/[slug]/page/[n]` generateMetadata** — thêm vào `apps/web/src/app/tags/[slug]/page/[n]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";

export function generateMetadata({ params }: { params: { slug: string; n: string } }): Metadata {
  return {
    title: `#${params.slug} · Trang ${params.n}`,
    description: `Các bài viết về chủ đề #${params.slug} — trang ${params.n}.`,
    alternates: { canonical: `${SITE_URL}/tags/${params.slug}/page/${params.n}` },
  };
}
```

- [ ] **Step 3: `/tags` static metadata** — thêm vào `apps/web/src/app/tags/page.tsx`:

```tsx
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Chủ đề",
  description: "Tất cả chủ đề trên blog.",
};
```

- [ ] **Step 4: Build verify + commit**

Run: `pnpm --filter @ultimate/web build` (cần core chạy) → không lỗi typecheck.

```bash
git add "apps/web/src/app/tags"
git commit -m "feat(web): metadata cho trang tag + tag/page/[n] + /tags (W4)"
```

---

### Task 4: Web — JSON-LD BlogPosting + cover sizes (W5 + low)

**Files:**
- Modify: `apps/web/src/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Thêm JSON-LD** — trong `BlogPostPage`, ngay sau `if (!post) notFound();` dựng object rồi render trong `<article>` (đầu `<article>`):

```tsx
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at,
    image: post.cover_image ?? undefined,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": "Person", name: SITE_NAME },
  };
```

Thêm import `import { SITE_URL, SITE_NAME } from "@/lib/config";`. Render (ngay trong `return`, trước `<ReadingProgress />` hoặc đầu `<main>`):

```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
```

- [ ] **Step 2: Cover image sizes** — thêm prop `sizes` vào `<Image>` cover:

```tsx
              sizes="(max-width: 42rem) 100vw, 42rem"
```

- [ ] **Step 3: Build verify + commit**

Run: `pnpm --filter @ultimate/web build` → OK.

```bash
git add "apps/web/src/app/blog/[slug]/page.tsx"
git commit -m "feat(web): JSON-LD BlogPosting + cover image sizes (W5)"
```

---

### Task 5: Web — not-found + error pages (W6)

**Files:**
- Create: `apps/web/src/app/not-found.tsx`, `apps/web/src/app/error.tsx`

- [ ] **Step 1: not-found.tsx** (server component):

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="article-kicker">404</p>
      <h1 className="article-title mt-3 text-[2.4rem]">Không tìm thấy trang</h1>
      <p className="mt-4 text-muted-foreground">
        Trang bạn tìm không tồn tại hoặc đã bị gỡ.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-75"
      >
        <span aria-hidden>←</span> Về trang chủ
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: error.tsx** (client component):

```tsx
"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
      <p className="article-kicker">500</p>
      <h1 className="article-title mt-3 text-[2.4rem]">Đã xảy ra lỗi</h1>
      <p className="mt-4 text-muted-foreground">Không tải được nội dung. Vui lòng thử lại.</p>
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Thử lại
        </button>
        <Link href="/" className="inline-flex items-center text-sm font-medium text-primary hover:opacity-75">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
```

(Header/footer đã ở `layout.tsx` bọc quanh → 2 trang này tự có SiteHeader/SiteFooter.)

- [ ] **Step 3: Build + verify + commit**

Run: `pnpm --filter @ultimate/web build`; `pnpm --filter @ultimate/web start` rồi `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/khong-ton-tai` → 404 (trang branded).

```bash
git add apps/web/src/app/not-found.tsx apps/web/src/app/error.tsx
git commit -m "feat(web): not-found + error pages branded (W6)"
```

---

### Task 6: Web — CSP headers + next.config gate (W7 CSP + low)

**Files:**
- Modify: `apps/web/next.config.mjs`

**Interfaces:**
- Produces: header `Content-Security-Policy` (không nonce), `X-Content-Type-Options`, `Referrer-Policy` cho mọi route; pattern localhost chỉ ở non-production; fail-fast thiếu `NEXT_PUBLIC_MEDIA_HOST` khi production.

- [ ] **Step 1: Implement** — thay `apps/web/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";
const mediaHost = process.env.NEXT_PUBLIC_MEDIA_HOST;

if (isProd && !mediaHost) {
  throw new Error("next.config: NEXT_PUBLIC_MEDIA_HOST là bắt buộc ở production build");
}

const imgSrc = ["'self'", "data:", mediaHost ? `https://${mediaHost}` : ""].filter(Boolean).join(" ");

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig = {
  transpilePackages: ["@ultimate/ui", "@ultimate/types"],
  images: {
    remotePatterns: [
      ...(isProd ? [] : [{ protocol: "http", hostname: "localhost" }]),
      ...(mediaHost ? [{ protocol: "https", hostname: mediaHost }] : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify static + header**

Run: `pnpm --filter @ultimate/web build` → routes vẫn `○`/`●` (KHÔNG `ƒ`).
Run (dev OK): `pnpm --filter @ultimate/web start` + `curl -sI http://localhost:3000/ | grep -i "content-security-policy\|x-content-type"` → thấy 2 header.

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.mjs
git commit -m "feat(web): CSP + security headers (không nonce, giữ SSG) + gate media host (W7)"
```

---

### Task 7: Web — sanitize content_html (W7 sanitize)

**Files:**
- Create: `apps/web/src/features/posts/sanitize.ts`
- Test: `apps/web/src/features/posts/sanitize.test.ts`
- Modify: `apps/web/src/features/posts/components/post-content.tsx`
- Modify: `apps/web/package.json` (deps)

**Interfaces:**
- Produces: `sanitizeHtml(html: string): Promise<string>` — loại `<script>`, `on*` handlers, `javascript:` href; giữ table/task-list/mark/img/code/heading/list/blockquote/hr/a.

- [ ] **Step 1: Cài deps**

Run: `pnpm --filter @ultimate/web add rehype-parse rehype-sanitize rehype-stringify unified`

- [ ] **Step 2: Write failing tests** — `apps/web/src/features/posts/sanitize.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("loại thẻ script", async () => {
    const out = await sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).toContain("<p>ok</p>");
    expect(out).not.toContain("<script");
  });
  it("loại on* handler", async () => {
    const out = await sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain("onerror");
  });
  it("loại javascript: href", async () => {
    const out = await sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });
  it("giữ table, mark, task-list checkbox", async () => {
    const html = '<table><tr><td>c</td></tr></table><mark>hi</mark><input type="checkbox" checked disabled>';
    const out = await sanitizeHtml(html);
    expect(out).toContain("<table");
    expect(out).toContain("<mark>");
    expect(out).toContain('type="checkbox"');
  });
  it("giữ link http + rel", async () => {
    const out = await sanitizeHtml('<a href="https://x.test">x</a>');
    expect(out).toContain('href="https://x.test"');
  });
});
```

- [ ] **Step 3: Run — verify fail**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/sanitize.test.ts`
Expected: FAIL (module chưa có).

- [ ] **Step 4: Implement** — `apps/web/src/features/posts/sanitize.ts`:

```ts
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

// Allowlist mở rộng cho output editor (Tiptap/Lexical): bảng, task-list, highlight, ảnh, code.
const schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "mark", "figure", "figcaption", "input",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
    a: [...(defaultSchema.attributes?.a ?? []), "rel", "target"],
    img: [...(defaultSchema.attributes?.img ?? []), "src", "alt", "title", "width", "height"],
    input: [["type", "checkbox"], "checked", "disabled"],
    th: [...(defaultSchema.attributes?.th ?? []), "colSpan", "rowSpan"],
    td: [...(defaultSchema.attributes?.td ?? []), "colSpan", "rowSpan"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https", "data"],
  },
};

const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

export async function sanitizeHtml(html: string): Promise<string> {
  const file = await processor.process(html);
  return String(file);
}
```

- [ ] **Step 5: Run — verify pass**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/sanitize.test.ts`
Expected: PASS (5/5).

- [ ] **Step 6: Dùng trong PostContent** — thay `apps/web/src/features/posts/components/post-content.tsx`:

```tsx
import { sanitizeHtml } from "@/features/posts/sanitize";

// content_html do chủ blog (tin cậy) tạo từ editor — vẫn sanitize server-side (RSC)
// làm defense-in-depth (W7). Chi phí trả 1 lần mỗi ISR render.
export async function PostContent({ html }: { html: string }) {
  const clean = await sanitizeHtml(html);
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

(`blog/[slug]/page.tsx` đã `await` post nên render `<PostContent>` trong async RSC — Next hỗ trợ async server component con; nếu type phàn nàn, `{/* @ts-expect-error async RSC */}` KHÔNG cần với Next 14 App Router.)

- [ ] **Step 7: Build + verify + commit**

Run: `pnpm --filter @ultimate/web build` → OK; test toàn bộ web xanh.

```bash
git add apps/web/src/features/posts/sanitize.ts apps/web/src/features/posts/sanitize.test.ts apps/web/src/features/posts/components/post-content.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): sanitize content_html server-side (rehype-sanitize) — defense-in-depth (W7)"
```

---

### Task 8: Web — next/font migration (font)

**Files:**
- Modify: `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts`, `apps/web/package.json`

- [ ] **Step 1: next/font trong layout** — sửa `apps/web/src/app/layout.tsx` (thêm đầu file):

```tsx
import { Inter, Lora } from "next/font/google";

const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const lora = Lora({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
```

Gắn class vào `<html>`:

```tsx
    <html lang="vi" className={`${inter.variable} ${lora.variable}`}>
```

- [ ] **Step 2: globals.css** — xoá 10 dòng `@import "@fontsource/..."` (dòng 1–10). Sửa 2 biến font trong `:root` để trỏ next/font variable:

```css
  --font-sans: var(--font-sans-next), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-serif-next), Georgia, "Times New Roman", serif;
```

LƯU Ý: next/font `variable: "--font-sans"` tạo biến `--font-sans` chứa font family. Để tránh trùng tên với biến hiện có, đổi next/font variable thành `--font-sans-next`/`--font-serif-next` (sửa Step 1 cho khớp: `variable: "--font-sans-next"` và `"--font-serif-next"`). Rồi `:root` map như trên.

- [ ] **Step 3: Chuẩn hoá weight lẻ trong globals.css** — thay: dòng 42 `font-weight: 650` → `600`; dòng 67 `680` → `700`; dòng 76 `660` → `700`; dòng 91 `640` → `600`; dòng 139 `620` → `600`.

- [ ] **Step 4: Gỡ dep @fontsource** — trong `apps/web/package.json` xoá các entry `@fontsource/inter`, `@fontsource/lora`. Run: `pnpm --filter @ultimate/web install`.

- [ ] **Step 5: Build + verify + commit**

Run: `pnpm --filter @ultimate/web build` → OK; mở `next start`, kiểm tra body serif render (font Lora nạp qua next/font, không FOUT).

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css apps/web/tailwind.config.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): migrate next/font (Lora+Inter) + chuẩn hoá weight (font low)"
```

---

### Task 9: Admin — type-safety cluster (A5, A7 + tagKeys ownership)

**Files:**
- Create: `apps/admin/src/features/tags/keys.ts`
- Modify: `apps/admin/src/features/posts/keys.ts` (bỏ tagKeys), `apps/admin/src/features/tags/api.ts`, `apps/admin/src/features/posts/queries.ts`, `apps/admin/src/features/posts/components/PostsToolbar.tsx`, `apps/admin/src/features/posts/PostsListPage.tsx`, `apps/admin/src/routes/_authed.posts.index.tsx`

**Interfaces:**
- Produces: `tagKeys` ở `features/tags/keys.ts`; `PostsToolbar` props `status: PostStatus | ""`, `onStatusChange: (v: PostStatus | "") => void`.

- [ ] **Step 1: tagKeys move** — tạo `apps/admin/src/features/tags/keys.ts`:

```ts
/** Query keys cho module tags. */
export const tagKeys = {
  all: ["tags"] as const,
  list: () => [...tagKeys.all, "list"] as const,
};
```

Xoá block `tagKeys` khỏi `apps/admin/src/features/posts/keys.ts` (dòng 14–17). Trong `apps/admin/src/features/tags/api.ts`: import `tagKeys` và dùng `queryKey: tagKeys.list()` trong `tagsQueryOptions`.

- [ ] **Step 2: A5 — invalidate tagKeys** — trong `apps/admin/src/features/posts/queries.ts`, import `tagKeys` từ `@/features/tags/keys`, và trong `useCreatePost` + `useUpdatePost` `onSuccess`:

```ts
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: postKeys.all });
      void qc.invalidateQueries({ queryKey: tagKeys.all });
    },
```

- [ ] **Step 3: A7 — PostStatus union** — `PostsToolbar.tsx`: đổi props type:

```tsx
  status: PostStatus | "";
  onStatusChange: (v: PostStatus | "") => void;
```

và `onValueChange={(v) => onStatusChange(v === ALL ? "" : (v as PostStatus))}` (cast chỉ nội bộ toolbar, chấp nhận — hoặc dùng statusOptions typed). Trong `PostsListPage.tsx`: xoá 2 cast `as PostStatus | ""` (dòng ~24, ~89). Trong `routes/_authed.posts.index.tsx`: đổi enum inline sang `PostStatusSchema.or(z.literal(""))` (import `PostStatusSchema` từ `@ultimate/types`).

- [ ] **Step 4: Test + build**

Run: `pnpm --filter @ultimate/admin test && pnpm --filter @ultimate/admin build`
Expected: xanh (typecheck bắt lỗi nếu union sai).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/tags/keys.ts apps/admin/src/features/posts/keys.ts apps/admin/src/features/tags/api.ts apps/admin/src/features/posts/queries.ts apps/admin/src/features/posts/components/PostsToolbar.tsx apps/admin/src/features/posts/PostsListPage.tsx apps/admin/src/routes/_authed.posts.index.tsx
git commit -m "refactor(admin): tagKeys ownership + invalidate tags sau mutation (A5) + PostStatus union end-to-end (A7)"
```

---

### Task 10: Admin — correctness cluster (A6, A8, A9 + apiClient + PostId)

**Files:**
- Create: `apps/admin/src/lib/table-meta.ts`
- Modify: `apps/admin/src/components/ui/data-table.tsx`, `apps/admin/src/lib/apiClient.ts`, `apps/admin/src/features/posts/queries.ts`, `apps/admin/src/features/posts/api.ts`, `apps/admin/src/features/auth/hooks.ts`, `packages/types/src/index.ts`

- [ ] **Step 1: A6 — TableMeta optional + move** — tạo `apps/admin/src/lib/table-meta.ts`:

```ts
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // onDelete optional — không ép mọi table phải có action xoá.
  interface TableMeta<TData> {
    onDelete?: (row: TData) => void;
  }
}
```

Xoá block `declare module "@tanstack/react-table"` khỏi `data-table.tsx`; thêm `import "@/lib/table-meta";` ở đầu `data-table.tsx`. Nơi đọc `meta.onDelete` xử lý optional (`meta?.onDelete?.(row)`).

- [ ] **Step 2: A8 — AbortSignal** — `apiClient.ts`: đảm bảo `apiFetch` truyền `init` (đã có `init?: RequestInit`) vào `fetch` — thêm forward `signal`. Trong `features/posts/queries.ts`, queryFn nhận `{ signal }`:

```ts
    queryFn: ({ signal }) => listPosts(params, signal),
```

và `features/posts/api.ts` `listPosts(params, signal?)` → `apiFetch(path, schema, { signal })`. Tương tự `getPostBySlug`.

- [ ] **Step 3: A9 — signout order** — `features/auth/hooks.ts` `useSignOut`:

```ts
    onSuccess: async () => {
      await navigate({ to: "/login" });
      qc.clear();
    },
```

- [ ] **Step 4: apiClient 204+schema throw + PostId** — `apiClient.ts`: nếu status 204 mà `schema !== null` → `throw new ApiSchemaError(path, "expected body but got 204")`. `features/posts/api.ts`: `updatePost(id: PostId, ...)` (import `PostId` từ `@ultimate/types`).

- [ ] **Step 5: rename ApiError interface** — trong `packages/types/src/index.ts` đổi tên interface envelope `ApiError` → `ApiErrorBody` (và mọi ref nội bộ trong types). Class `ApiError` ở `apiClient.ts` giữ nguyên (không liên quan).

- [ ] **Step 6: Test + build**

Run: `pnpm --filter @ultimate/admin test && pnpm --filter @ultimate/admin build && pnpm --filter @ultimate/types build`
Expected: xanh.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/lib/table-meta.ts apps/admin/src/components/ui/data-table.tsx apps/admin/src/lib/apiClient.ts apps/admin/src/features/posts/queries.ts apps/admin/src/features/posts/api.ts apps/admin/src/features/auth/hooks.ts packages/types/src/index.ts
git commit -m "refactor(admin): TableMeta optional (A6) + AbortSignal (A8) + signout order (A9) + apiClient 204/PostId/rename"
```

---

### Task 11: Admin — a11y + UX polish (low)

**Files:**
- Modify: `packages/ui/src/components/toast.tsx`, `apps/admin/src/components/ui/data-table.tsx`, `apps/admin/src/features/posts/PostsListPage.tsx`, `apps/admin/src/app/Topbar.tsx`

- [ ] **Step 1: toast role=alert** — trong `packages/ui/src/components/toast.tsx`, toast biến thể error dùng `role="alert"` (thay `role="status"`); các toast khác giữ `status`.

- [ ] **Step 2: aria-sort** — `data-table.tsx`, `<th>` sortable thêm `aria-sort={col.getIsSorted() === "asc" ? "ascending" : col.getIsSorted() === "desc" ? "descending" : "none"}`.

- [ ] **Step 3: clamp page sau delete** — `PostsListPage.tsx`, sau khi xoá thành công: nếu `page > totalPages(total-1, PAGE_SIZE)` thì `navigate` về trang cuối mới (dùng cơ chế set search hiện có).

- [ ] **Step 4: Topbar link** — `app/Topbar.tsx`, nút "Thêm bài viết" bọc `<Button asChild><Link to="/posts/new">...</Link></Button>` (import `Link` từ `@tanstack/react-router`).

- [ ] **Step 5: Test + build**

Run: `pnpm --filter @ultimate/admin test && pnpm --filter @ultimate/admin build && pnpm --filter @ultimate/ui build`
Expected: xanh.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/toast.tsx apps/admin/src/components/ui/data-table.tsx apps/admin/src/features/posts/PostsListPage.tsx apps/admin/src/app/Topbar.tsx
git commit -m "polish(admin): toast role=alert + th aria-sort + clamp page sau delete + Topbar link (low a11y/UX)"
```

---

### Task 12: Verify E2E + security-review + đánh dấu RESOLVED

- [ ] **Step 1: Build toàn bộ**

Run: `pnpm --filter @ultimate/ui build && pnpm --filter @ultimate/types build && pnpm --filter @ultimate/admin build && pnpm --filter @ultimate/web build`
Expected: tất cả xanh; web routes static (`○`/`●`, không `ƒ`).

- [ ] **Step 2: Web E2E (production)** — core chạy + `next start`:
- `curl -sI localhost:3000/ | grep -i content-security-policy` → có CSP.
- Tạo/kiểm 1 bài có `<script>alert(1)</script>` trong content_html (seed tạm hoặc sửa qua admin) → view `/blog/<slug>` → script KHÔNG có trong HTML (bị sanitize). Xoá seed tạm sau.
- `curl -s -o /dev/null -w "%{http_code}" localhost:3000/khong-ton-tai` → 404.
- `curl -s localhost:3000/rss.xml | grep -c "atom:link"` → ≥1.

- [ ] **Step 3: Full test**

Run: `pnpm --filter @ultimate/web test && pnpm --filter @ultimate/admin test`
Expected: tất cả xanh.

- [ ] **Step 4: security-review** — invoke skill `security-review` cho diff branch; chú ý CSP đủ chặt + sanitize allowlist không hở `javascript:`/`on*`. Xử lý finding ≥ high.

- [ ] **Step 5: Đánh dấu RESOLVED** — trong `docs/reviews/2026-07-11-senior-code-review.md` thêm `✅ RESOLVED (2026-07-11, commit <hash>)` cho: W3, W4, W5, W6, W7, các low SEO (OG/RSS/sizes/next.config), font, A5, A6, A7, A8, A9, và admin low đã làm (tagKeys, PostId, apiClient 204/rename, toast role, aria-sort, clamp page, Topbar). Không xoá nội dung finding.

- [ ] **Step 6: Cập nhật CLAUDE.md** — thêm dòng **Slice 5c — DONE**; cập nhật "📍 Điểm hiện tại" + "🩺 Issue tracker" (còn lại chỉ nhóm B → Slice 5d: M1–M5 core + outbox).

- [ ] **Step 7: Final commit**

```bash
git add docs/reviews/2026-07-11-senior-code-review.md CLAUDE.md docs/superpowers/plans/2026-07-11-slice5c-polish-fe.md
git commit -m "docs: đánh dấu W3-W7 + A5-A9 resolved — Slice 5c hoàn tất"
```
