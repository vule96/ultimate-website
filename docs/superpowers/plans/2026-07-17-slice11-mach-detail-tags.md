# Slice 11 — Redesign detail/tags theo chrome Mạch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/blog/[slug]`, `/tags`, `/tags/[slug]`, `/page/[n]` chuyển sang ngôn ngữ Mạch (token, Roboto display, meta mono, màu category, thumbnail blurhash) + section "Bài liên quan".

**Architecture:** Toàn bộ là restyle RSC — không đổi routing/SSG/ISR/metadata. Logic mới duy nhất: `pickRelated` (hàm thuần, TDD) + `RelatedPosts` (RSC fetch ISR). Màu category lấy từ `categories.ts` qua `categoryFromTags`/`CATEGORY_BY_KEY` sẵn có.

**Tech Stack:** sẵn có — không cài thêm dependency.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-17-slice11-mach-detail-tags-design.md`.
- Không đổi: routing, `revalidate=60`, metadata/JSON-LD/hreflang, `notFound` non-published, sanitize.
- Cấm hex trong component — màu category từ `categories.ts`, còn lại token Tailwind Mạch.
- Tint pattern: `color-mix(in srgb, <color> var(--tint-strength), transparent)`.
- i18n: key mới vào `messages/vi.json` → `pnpm i18n:gen` → dịch `en.json` (guard test enforce).
- Test: `pnpm --filter @ultimate/web test`; build: `pnpm --filter @ultimate/web build`.

---

### Task 1: i18n keys mới

**Files:** `apps/web/messages/vi.json`, `apps/web/messages/en.json` (gen + dịch)

- [ ] vi.json — namespace `detail` thêm: `"related": "Bài liên quan"`, `"views": "{count} lượt xem"`; `tagsPage` thêm: `"count": "{count} bài viết"`.
- [ ] `pnpm --filter @ultimate/web i18n:gen` → en.json thêm khung `__TODO__` → dịch: `related: "Related articles"`, `views: "{count} views"`, `count: "{count} articles"`.
- [ ] Test guard xanh → commit `feat(web): i18n keys detail.related/views + tagsPage.count`.

### Task 2: `pickRelated` (TDD) + `RelatedPosts` RSC

**Files:**
- Create: `apps/web/src/features/posts/related.ts` + `related.test.ts`
- Create: `apps/web/src/features/posts/components/related-posts.tsx`
- Modify: `app/[locale]/blog/[slug]/page.tsx` (mount cuối bài, trước footer tags)

**Interfaces:**
- Produces: `pickRelated(candidates: Post[], currentSlug: string, limit = 3): Post[]` (lọc bài hiện tại, cắt limit); `RelatedPosts({ post }: { post: Post })` RSC async — tự fetch, render `null` khi rỗng.

- [ ] **Test fail** `related.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickRelated } from "./related";
import type { Post } from "@ultimate/types";

const mk = (slug: string) => ({ slug }) as Post;

describe("pickRelated", () => {
  it("loại bài hiện tại", () => {
    expect(pickRelated([mk("a"), mk("b")], "a").map((p) => p.slug)).toEqual(["b"]);
  });
  it("cắt tối đa limit", () => {
    expect(pickRelated([mk("a"), mk("b"), mk("c"), mk("d")], "x", 3)).toHaveLength(3);
  });
  it("rỗng khi chỉ có bài hiện tại", () => {
    expect(pickRelated([mk("a")], "a")).toEqual([]);
  });
});
```

- [ ] **Implement** `related.ts`:

```ts
import type { Post } from "@ultimate/types";

/** Chọn bài liên quan: bỏ bài đang đọc, lấy tối đa limit. */
export function pickRelated(candidates: Post[], currentSlug: string, limit = 3): Post[] {
  return candidates.filter((p) => p.slug !== currentSlug).slice(0, limit);
}
```

- [ ] **`related-posts.tsx`** (RSC — fetch theo tag đầu, fallback bài mới nhất):

```tsx
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPublished } from "@/features/posts/api";
import { pickRelated } from "@/features/posts/related";
import { CoverImage } from "@/features/posts/components/cover-image";
import { categoryFromTags, CATEGORY_BY_KEY } from "@/features/magazine/categories";
import { formatDate } from "@/features/magazine/lib/format";
import type { Post } from "@ultimate/types";

/** Section "Bài liên quan" — 3 bài cùng tag đầu (fallback bài mới nhất). */
export async function RelatedPosts({ post }: { post: Post }) {
  const t = await getTranslations("detail");
  const tag = post.tags[0]?.slug;
  const { data } = await listPublished(tag ? { tag } : {}).catch(() => ({ data: [] as Post[] }));
  const related = pickRelated(data, post.slug);
  if (related.length === 0) return null;

  return (
    <section className="mt-14 border-t border-line pt-8">
      <h2 className="mb-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        {t("related")}
      </h2>
      <div className="grid gap-6 sm:grid-cols-3">
        {related.map((p) => {
          const cat = CATEGORY_BY_KEY[categoryFromTags(p.tags)];
          return (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group block no-underline">
              {p.cover_image ? (
                <CoverImage
                  src={p.cover_image}
                  alt=""
                  hash={p.cover_blurhash}
                  sizes="(max-width: 640px) 100vw, 220px"
                  className="mb-3 rounded-lg"
                />
              ) : (
                <div className="mb-3 aspect-[16/9] rounded-lg" style={{ backgroundColor: cat.color }} />
              )}
              <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: cat.color }}>
                {p.tags[0]?.name ?? cat.label}
              </span>
              <h3 className="mt-1 font-display text-[16px] font-bold leading-[1.3] text-fg group-hover:text-accent">
                {p.title}
              </h3>
              {p.published_at ? (
                <span className="mt-1 block font-mono text-[10.5px] text-muted">
                  {formatDate(p.published_at)}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] Mount trong blog detail: sau khối tags footer, trong `<footer>`: `<RelatedPosts post={post} />`.
- [ ] Test pass toàn bộ → commit `feat(web): RelatedPosts — 3 bài cùng tag, pickRelated TDD`.

### Task 3: Detail restyle Editorial Mạch

**Files:** `app/[locale]/blog/[slug]/page.tsx`, `apps/web/src/app/globals.css` (`.article-body` → token Mạch; xoá `.article-kicker`/`.article-title` khi hết nơi dùng)

- [ ] Header bài: kicker → `<span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: cat.color }}>{cat.label}</span>` (cat = `CATEGORY_BY_KEY[categoryFromTags(post.tags)]`); title → `font-display text-[2rem] font-black leading-[1.15] tracking-[-0.01em] sm:text-[2.6rem]`; meta → dòng `font-mono text-[11px] text-muted`: `formatDate(...)` + `t("readMinutes", {minutes})` + (views > 0 ? `t("views", {count: formatViews(views)})` : ẩn) ngăn bằng `·`.
- [ ] Footer tags → chips: `rounded-full px-3 py-1 text-[12px] font-semibold no-underline` + `style={{ color: cat.color, background: "color-mix(in srgb, "+cat.color+" var(--tint-strength), transparent)" }}` (cat theo từng tag qua `categoryFromTags([tag])`). Link "Xem tất cả bài viết" → `text-accent`.
- [ ] `.article-body` trong globals.css: đổi sang token Mạch — body `color: var(--fg)`, font giữ serif? → đổi `font-family: var(--font-sans)` (Be Vietnam Pro — đồng bộ Mạch), link `color: var(--accent)`, blockquote `border-left: 3px solid var(--accent); background: var(--soft)`, `code/pre` nền `var(--soft)` viền `var(--line)`, headings `font-family: var(--font-display)`, hr `border-color: var(--line)` (đọc block hiện có rồi thay giá trị — KHÔNG đổi cấu trúc selector).
- [ ] Trang không còn dùng `.article-kicker/.article-title` sau Task 5 → xoá 2 class ở bước Task 5.
- [ ] Test + build xanh → commit `feat(web): blog detail editorial Mạch — kicker category màu, title display, meta mono + views, tag chips tint, prose token`.

### Task 4: PostCard row Mạch + PostList + Pagination

**Files:** `post-card.tsx` (viết lại), `post-list.tsx`, `pagination.tsx`, test `post-card.test.tsx` (mới)

- [ ] **Test fail** `post-card.test.tsx` (renderWithIntl không cần — component không dùng i18n; render thẳng):

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostCard } from "./post-card";
// fixture Post đầy đủ field (copy pattern từ article-vm.test.ts, thêm cover_blurhash/views)

describe("PostCard (row Mạch)", () => {
  it("render title + kicker category + meta mono", () => {
    render(<PostCard post={fixture} />);
    expect(screen.getByRole("heading")).toHaveTextContent(fixture.title);
    expect(screen.getByText("AI")).toBeInTheDocument(); // tag đầu
  });
  it("có cover → khung thumbnail cố định (chống CLS)", () => {
    const { container } = render(<PostCard post={fixture} />);
    expect(container.querySelector("[data-thumb]")).not.toBeNull();
  });
});
```

- [ ] **Viết lại `post-card.tsx`** — row Mạch server-thuần: `<article className="group py-6 border-b border-line last:border-0">` chứa `<Link className="flex gap-[18px] no-underline">`: thumbnail (`data-thumb`, `relative hidden h-[90px] w-[132px] flex-none overflow-hidden rounded-lg sm:block`, nền `cat.color`, `BlurhashCanvas hash` + `next/image fill sizes="132px" quality={75}` khi có cover) + khối text: dòng kicker (`style color cat.color` label tag đầu + `·` + ngày mono + `·` + phút đọc mono `text-muted`), title `font-display text-[20px] font-bold leading-[1.25] text-fg group-hover:text-accent`, excerpt `mt-1.5 text-[14px] leading-[1.6] text-muted line-clamp-2`.
- [ ] `post-list.tsx`: bỏ `divide-border` shadcn → `divide-y divide-line`? (PostCard tự border-b — dùng `<div>` trơn); empty state → `border-line text-muted`.
- [ ] `pagination.tsx`: LINK → `inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-fg no-underline hover:text-accent`; giữa → `font-mono text-[12px] text-muted`; `border-t` → `border-line`.
- [ ] Test pass → commit `feat(web): PostCard row Mạch (thumbnail blurhash, kicker màu category) + pagination token`.

### Task 5: PostsPage + /tags headers

**Files:** `posts-page.tsx`, `app/[locale]/tags/page.tsx`, globals.css (xoá `.article-kicker`/`.article-title`), error/not-found nếu còn dùng class cũ (giữ — check grep)

- [ ] `posts-page.tsx`: header dùng `getTranslations("tagsPage")`; kicker mono muted uppercase; title `font-display font-black`; tag page: `#${tag}` màu category (`categoryFromTags([{name: tag, slug: tag}])`), dòng `t("count", {count: total})` mono muted; container giữ `max-w-3xl`.
- [ ] `tags/page.tsx`: chips → màu category: `categoryFromTags([{name: t.name, slug: t.slug}])` → cat; style tint như tag chips detail; header kicker/title mới.
- [ ] `grep -rn "article-kicker\|article-title" apps/web/src` → còn `error.tsx`/`not-found.tsx` dùng → đổi 2 trang đó sang kicker mono + `font-display` rồi **xoá 2 class khỏi globals.css**.
- [ ] Test + build → commit `feat(web): PostsPage + /tags chrome Mạch, xoá class theme cũ`.

### Task 6: Verify + docs + merge

- [ ] `pnpm --filter @ultimate/web test` + `build` xanh (routes như cũ).
- [ ] E2E live (core prod :8080 đang chạy): `/blog/[slug]` — kicker màu, meta views, chips tag, related 3 bài, dark mode; `/tags` chips màu; `/tags/[slug]` row Mạch + count; `/page/2` pagination mới; mobile 390px; `/en` bản dịch key mới.
- [ ] CLAUDE.md (Slice 11 DONE + 📍) + status-roadmap.html + architecture.md → commit, merge `slice-11-mach-detail-tags` → main, push.
