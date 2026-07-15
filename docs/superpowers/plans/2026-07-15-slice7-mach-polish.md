# Slice 7 — Polish trang chủ "Mạch" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish trang chủ Mạch: max-width cho masthead/subnav, hệ token màu chrome/ink/field (light+dark), đổi font display sang Playfair Display, redesign newsletter (state machine + inline success/error), sửa re-render (stable callbacks), animation framer-motion tiết chế.

**Architecture:** Không đổi RSC shell + client island của Slice 6. Mọi thay đổi nằm trong `apps/web`: CSS token (`globals.css` + `tailwind.config.ts`), component chrome (`masthead/sub-nav/magazine-footer/auth-menu/search-bar`), `NewsletterBox` viết lại quanh hook `useNewsletterForm` (TDD), animation qua `LazyMotion + domAnimation` + `m.` trong `MagazineBoard`.

**Tech Stack:** Next.js 14 App Router, Tailwind v3, Zustand, framer-motion (mới), Vitest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-15-slice7-mach-polish-design.md`.
- **Cấm** import `motion.` từ framer-motion — chỉ `LazyMotion features={domAnimation} strict` + component `m.` (~5KB).
- **Cấm hex trong component** — chỉ class ngữ nghĩa từ token (trừ category color đã có nguồn ở `categories.ts`).
- Chỉ animate `transform`/`opacity`; `<MotionConfig reducedMotion="user">`.
- Không đổi: RSC shell `app/page.tsx`, `revalidate = 60`, metadata/sitemap/rss, interface `NewsletterService`.
- Test chạy: `pnpm --filter @ultimate/web test`. Build: `pnpm --filter @ultimate/web build`.
- Font var giữ nguyên tên `--font-display-next`; `max-w-shell` = **1200px**.
- Commit message tiếng Việt kiểu hiện có (`feat(web): …`), kết bằng `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Token màu chrome/ink/field + max-w-shell 1200px

**Files:**
- Modify: `apps/web/src/app/globals.css` (khối `:root` dòng 8–27 và `.dark` dòng 28–36)
- Modify: `apps/web/tailwind.config.ts`

**Interfaces:**
- Produces: Tailwind classes `bg-chrome-bg text-chrome-fg text-chrome-muted border-chrome-line bg-ink text-ink-fg text-ink-muted bg-field-bg text-field-fg ring-field-ring` + `max-w-shell` (1200px) — các task sau dùng.

- [ ] **Step 1: Thêm token vào `globals.css`**

Trong `:root`, sau dòng `--shadow-modal: …;` thêm:

```css
  /* Chrome (masthead + subnav) */
  --chrome-bg: #fffdf8;
  --chrome-fg: #1c1a16;
  --chrome-muted: #726a5b;
  --chrome-line: rgba(28, 26, 22, 0.11);
  /* Ink (footer + newsletter card) */
  --ink: #232019;
  --ink-fg: #f3efe6;
  --ink-muted: rgba(243, 239, 230, 0.62);
  /* Field (input) */
  --field-bg: #ffffff;
  --field-fg: #1c1a16;
  --field-ring: color-mix(in srgb, var(--accent) 55%, transparent);
```

Trong `.dark`, sau dòng `--tint-strength: 24%;` thêm:

```css
  --chrome-bg: #201d18;
  --chrome-fg: #efe9df;
  --chrome-muted: #a89d8b;
  --chrome-line: rgba(239, 233, 223, 0.14);
  --ink: #12100d;
  --ink-fg: #e8e2d6;
  --ink-muted: rgba(232, 226, 214, 0.55);
  --field-bg: #2a2620;
  --field-fg: #efe9df;
```

- [ ] **Step 2: Map vào `tailwind.config.ts`**

Trong `theme.extend.colors` thêm (giữ nguyên key cũ):

```ts
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
```

Đổi `maxWidth: { prose: "42rem", shell: "1160px" }` → `maxWidth: { prose: "42rem", shell: "1200px" }`.

- [ ] **Step 3: Chạy test + build để chắc không vỡ**

Run: `pnpm --filter @ultimate/web test` → Expected: 56 test PASS.
Run: `pnpm --filter @ultimate/web build` → Expected: build xanh.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/tailwind.config.ts
git commit -m "feat(web): token chrome/ink/field light+dark + max-w-shell 1200px"
```

---

### Task 2: Đổi font display → Playfair Display + tinh chỉnh tracking

**Files:**
- Modify: `apps/web/src/app/layout.tsx:3,9-14`
- Modify: `apps/web/src/app/globals.css` (dòng `--font-display`)

**Interfaces:**
- Consumes: token Task 1 (không bắt buộc).
- Produces: `font-display` render Playfair Display — mọi component giữ nguyên class.

- [ ] **Step 1: Sửa `layout.tsx`**

Đổi import và khai báo font (giữ tên biến `display` và var `--font-display-next`):

```tsx
import { Playfair_Display, Be_Vietnam_Pro, Space_Mono } from "next/font/google";

const display = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["700", "800"],
  variable: "--font-display-next",
  display: "swap",
});
```

- [ ] **Step 2: Sửa fallback trong `globals.css`**

```css
  --font-display: var(--font-display-next), "Playfair Display", Georgia, serif;
```

- [ ] **Step 3: Build + xem nhanh**

Run: `pnpm --filter @ultimate/web build` → Expected: xanh, không warning font subset.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css
git commit -m "feat(web): font display Playfair Display (subset vietnamese)"
```

---

### Task 3: Masthead + SubNav — max-width inner + màu chrome

**Files:**
- Modify: `apps/web/src/features/magazine/components/masthead.tsx`
- Modify: `apps/web/src/features/magazine/components/sub-nav.tsx`
- Modify: `apps/web/src/features/magazine/components/search-bar.tsx`
- Modify: `apps/web/src/features/magazine/components/auth-menu.tsx`
- Test: `apps/web/src/features/magazine/components/magazine-board.test.tsx` (chạy lại, sửa nếu assert class cũ)

**Interfaces:**
- Consumes: token Task 1.
- Produces: chrome full-bleed nền `chrome-bg`, nội dung bọc `mx-auto max-w-shell`; logo/CTA giữ accent.

- [ ] **Step 1: Viết lại `masthead.tsx`**

```tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/use-theme";
import { SearchBar } from "./search-bar";
import { AuthMenu } from "./auth-menu";

export function Masthead() {
  const { dark, toggle } = useTheme();
  return (
    <header className="border-b border-chrome-line bg-chrome-bg text-chrome-fg">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-[22px] px-[30px] py-5">
        <div className="flex items-baseline gap-[14px]">
          <span className="font-display text-[34px] font-extrabold leading-[0.9] tracking-[-0.015em] text-accent">
            Mạch
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-chrome-muted">
            Tạp chí tri thức
          </span>
        </div>
        <SearchBar />
        <div className="flex items-center gap-[10px]">
          <button
            onClick={toggle}
            aria-label="Đổi giao diện sáng/tối"
            className="flex items-center gap-[7px] rounded-lg border border-chrome-line bg-soft px-[13px] py-[9px] text-[12.5px] font-semibold text-chrome-fg"
          >
            {dark ? <Sun size={13} /> : <Moon size={13} />}
            {dark ? "Sáng" : "Tối"}
          </button>
          <AuthMenu />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Viết lại `sub-nav.tsx`**

```tsx
const META = "SỐ 128 · 12.07.2026 · CẬP NHẬT MỖI NGÀY";

export function SubNav() {
  return (
    <div className="border-b border-chrome-line bg-chrome-bg">
      <div className="mx-auto flex max-w-shell items-center justify-between gap-5 px-[30px] py-[11px]">
        <nav className="flex gap-[26px] text-[13.5px] font-semibold">
          <a href="/" className="text-chrome-fg no-underline">
            Trang chủ
          </a>
          <a href="/tags" className="text-chrome-muted no-underline">
            Danh mục
          </a>
          <a href="/" className="text-chrome-muted no-underline">
            Khám phá
          </a>
        </nav>
        <span className="font-mono text-[11px] tracking-[0.06em] text-chrome-muted">{META}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `search-bar.tsx` — đổi trắng-trên-xanh sang field token**

Đổi 3 chỗ class (giữ logic nguyên):

```tsx
    <div className="flex max-w-[400px] flex-1 items-center gap-[9px] rounded-[9px] border border-chrome-line bg-field-bg px-[15px] py-[10px] focus-within:ring-2 focus-within:ring-field-ring">
      <Search size={15} className="flex-none text-chrome-muted" strokeWidth={2} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm bài viết, chủ đề, tác giả…"
        className="flex-1 border-none bg-transparent text-[13.5px] text-field-fg outline-none placeholder:text-chrome-muted"
      />
    </div>
```

- [ ] **Step 4: `auth-menu.tsx` — đổi màu nút theo chrome**

Nhánh chưa đăng nhập:

```tsx
        <button
          onClick={() => openAuth("login")}
          className="rounded-lg border border-chrome-line bg-soft px-[14px] py-[9px] text-[12.5px] font-semibold text-chrome-fg"
        >
          Đăng nhập
        </button>
        <button
          onClick={() => openAuth("register")}
          className="rounded-lg bg-accent px-[14px] py-[9px] text-[12.5px] font-bold text-white"
        >
          Đăng ký
        </button>
```

Nhánh đã đăng nhập (badge/avatar/nút thoát):

```tsx
      <span className="rounded-lg border border-chrome-line bg-soft px-[13px] py-[9px] text-[12.5px] font-bold text-chrome-fg">
        Đã lưu {savedCount}
      </span>
      <div className="flex items-center gap-2">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent text-[13px] font-bold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-[13px] font-semibold text-chrome-fg">{user.name}</span>
      </div>
      <button
        onClick={logout}
        className="rounded-lg border border-chrome-line px-[12px] py-[9px] text-[12px] text-chrome-muted"
      >
        Thoát
      </button>
```

- [ ] **Step 5: Chạy test, sửa assertion nếu vỡ**

Run: `pnpm --filter @ultimate/web test` → Expected: PASS (magazine-board.test.tsx assert hành vi, nếu có assert class/màu cũ thì cập nhật theo class mới ở trên).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/magazine/components/masthead.tsx apps/web/src/features/magazine/components/sub-nav.tsx apps/web/src/features/magazine/components/search-bar.tsx apps/web/src/features/magazine/components/auth-menu.tsx apps/web/src/features/magazine/components/magazine-board.test.tsx
git commit -m "feat(web): masthead+subnav max-w-shell inner, chuyển hệ màu chrome hoà body"
```

---

### Task 4: Footer → ink token

**Files:**
- Modify: `apps/web/src/features/magazine/components/magazine-footer.tsx`

**Interfaces:**
- Consumes: token `ink/ink-fg/ink-muted` Task 1.
- Produces: footer nền `bg-ink`; NewsletterBox (Task 6) render trên nền này.

- [ ] **Step 1: Đổi class trong `magazine-footer.tsx`**

- Dòng `<footer …>`: `bg-fg … text-bg` → `bg-ink … text-ink-fg`.
- Logo "Mạch": thêm `text-accent`, tracking `-0.03em` → `-0.015em`.
- Mô tả + link cột (`opacity-70`): thay bằng `text-ink-muted` (bỏ opacity).
- Social icon: `bg-white/10 … text-bg` → `bg-ink-fg/10 … text-ink-fg`.
- Heading cột (`opacity-50`): `text-ink-muted`.
- Đường kẻ `border-white/15` → `border-ink-fg/15`; dòng copyright `opacity-50` → `text-ink-muted`.

Kết quả các dòng chính:

```tsx
    <footer className="bg-ink px-[30px] pb-6 pt-[46px] text-ink-fg">
      <div className="mx-auto grid max-w-shell grid-cols-[1.7fr_1fr_1fr_1.3fr] gap-[38px] border-b border-ink-fg/15 pb-8">
        <div>
          <div className="mb-[11px] font-display text-[27px] font-extrabold tracking-[-0.015em] text-accent">Mạch</div>
          <p className="mb-[18px] max-w-[290px] text-[13px] leading-[1.65] text-ink-muted">…</p>
```

(giữ nguyên nội dung text và cấu trúc; chỉ thay class như liệt kê).

- [ ] **Step 2: Test + build**

Run: `pnpm --filter @ultimate/web test` → PASS. `pnpm --filter @ultimate/web build` → xanh.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/magazine/components/magazine-footer.tsx
git commit -m "feat(web): footer chuyển nền ink ấm, đồng bộ token với body"
```

---

### Task 5: Hook `useNewsletterForm` (TDD)

**Files:**
- Create: `apps/web/src/features/magazine/hooks/use-newsletter-form.ts`
- Test: `apps/web/src/features/magazine/hooks/use-newsletter-form.test.ts`

**Interfaces:**
- Consumes: `NewsletterService` từ `../services/newsletter-service`.
- Produces:

```ts
export type NewsletterStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function useNewsletterForm(service: NewsletterService): {
  email: string;
  setEmail: (v: string) => void;
  status: NewsletterStatus;
  submit: () => Promise<void>;
};
```

- [ ] **Step 1: Viết test fail**

```ts
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNewsletterForm } from "./use-newsletter-form";
import type { NewsletterService } from "../services/newsletter-service";

const okService: NewsletterService = { subscribe: vi.fn().mockResolvedValue(undefined) };

describe("useNewsletterForm", () => {
  it("bắt đầu ở idle với email rỗng", () => {
    const { result } = renderHook(() => useNewsletterForm(okService));
    expect(result.current.status).toEqual({ kind: "idle" });
    expect(result.current.email).toBe("");
  });

  it("email sai → error, không gọi service", async () => {
    const service: NewsletterService = { subscribe: vi.fn() };
    const { result } = renderHook(() => useNewsletterForm(service));
    act(() => result.current.setEmail("khong-phai-email"));
    await act(() => result.current.submit());
    expect(result.current.status).toEqual({ kind: "error", message: "Email không hợp lệ." });
    expect(service.subscribe).not.toHaveBeenCalled();
  });

  it("email đúng → submitting rồi success, gọi service với email, reset email", async () => {
    const subscribe = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useNewsletterForm({ subscribe }));
    act(() => result.current.setEmail("a@b.vn"));
    await act(() => result.current.submit());
    expect(subscribe).toHaveBeenCalledWith("a@b.vn");
    expect(result.current.status).toEqual({ kind: "success" });
    expect(result.current.email).toBe("");
  });

  it("service ném lỗi → error hệ thống", async () => {
    const subscribe = vi.fn().mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useNewsletterForm({ subscribe }));
    act(() => result.current.setEmail("a@b.vn"));
    await act(() => result.current.submit());
    expect(result.current.status).toEqual({
      kind: "error",
      message: "Có lỗi xảy ra, thử lại sau nhé.",
    });
  });

  it("sửa email sau lỗi → quay về idle", async () => {
    const { result } = renderHook(() => useNewsletterForm(okService));
    act(() => result.current.setEmail("sai"));
    await act(() => result.current.submit());
    act(() => result.current.setEmail("sai@roi.vn"));
    expect(result.current.status).toEqual({ kind: "idle" });
  });
});
```

- [ ] **Step 2: Chạy test xác nhận fail**

Run: `pnpm --filter @ultimate/web test -- use-newsletter-form`
Expected: FAIL — module `./use-newsletter-form` không tồn tại.

- [ ] **Step 3: Implement**

```ts
"use client";
import { useCallback, useState } from "react";
import type { NewsletterService } from "../services/newsletter-service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NewsletterStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function useNewsletterForm(service: NewsletterService) {
  const [email, setEmailRaw] = useState("");
  const [status, setStatus] = useState<NewsletterStatus>({ kind: "idle" });

  const setEmail = useCallback((v: string) => {
    setEmailRaw(v);
    setStatus((s) => (s.kind === "error" ? { kind: "idle" } : s));
  }, []);

  const submit = useCallback(async () => {
    if (!EMAIL_RE.test(email)) {
      setStatus({ kind: "error", message: "Email không hợp lệ." });
      return;
    }
    setStatus({ kind: "submitting" });
    try {
      await service.subscribe(email);
      setEmailRaw("");
      setStatus({ kind: "success" });
    } catch {
      setStatus({ kind: "error", message: "Có lỗi xảy ra, thử lại sau nhé." });
    }
  }, [email, service]);

  return { email, setEmail, status, submit };
}
```

- [ ] **Step 4: Chạy test pass**

Run: `pnpm --filter @ultimate/web test -- use-newsletter-form` → Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/magazine/hooks/use-newsletter-form.ts apps/web/src/features/magazine/hooks/use-newsletter-form.test.ts
git commit -m "feat(web): hook useNewsletterForm — state machine idle/submitting/success/error (TDD)"
```

---

### Task 6: Redesign `NewsletterBox` dùng hook

**Files:**
- Modify: `apps/web/src/features/magazine/components/newsletter-box.tsx` (viết lại toàn bộ)
- Test: `apps/web/src/features/magazine/components/newsletter-box.test.tsx` (mới)

**Interfaces:**
- Consumes: `useNewsletterForm` (Task 5), token `ink/field/accent` (Task 1).
- Produces: `NewsletterBox({ variant: "rail" | "footer" })` — API prop không đổi (caller `category-rail.tsx`, `magazine-footer.tsx` giữ nguyên).

- [ ] **Step 1: Viết test component fail**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewsletterBox } from "./newsletter-box";

describe("NewsletterBox", () => {
  it("email sai → báo lỗi inline + aria-invalid", async () => {
    render(<NewsletterBox variant="rail" />);
    await userEvent.type(screen.getByPlaceholderText("Email của bạn"), "sai");
    await userEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Email không hợp lệ.");
    expect(screen.getByPlaceholderText("Email của bạn")).toHaveAttribute("aria-invalid", "true");
  });

  it("email đúng → hiện success inline thay form", async () => {
    render(<NewsletterBox variant="footer" />);
    await userEvent.type(screen.getByPlaceholderText("Email của bạn"), "a@b.vn");
    await userEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(await screen.findByText(/Đã đăng ký/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Email của bạn")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test fail** — Run: `pnpm --filter @ultimate/web test -- newsletter-box` → FAIL (placeholder/markup cũ).

- [ ] **Step 3: Viết lại component**

```tsx
"use client";
import { CheckCircle2 } from "lucide-react";
import { useNewsletterForm } from "../hooks/use-newsletter-form";
import { localNewsletterService } from "../services/newsletter-service";

const BENEFIT = "Mỗi sáng thứ Hai · 5 phút đọc · Huỷ bất kỳ lúc nào";

export function NewsletterBox({ variant }: { variant: "rail" | "footer" }) {
  const { email, setEmail, status, submit } = useNewsletterForm(localNewsletterService);
  const invalid = status.kind === "error";

  const form =
    status.kind === "success" ? (
      <p role="status" className="flex items-center gap-2 text-[13px] font-semibold text-ink-fg">
        <CheckCircle2 size={15} className="text-accent" /> Đã đăng ký — hẹn bạn thứ Hai!
      </p>
    ) : (
      <>
        <div
          className={`flex overflow-hidden rounded-lg border ${
            invalid ? "border-red-400" : "border-transparent"
          } bg-field-bg focus-within:ring-2 focus-within:ring-field-ring`}
        >
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Email của bạn"
            aria-invalid={invalid || undefined}
            disabled={status.kind === "submitting"}
            className="min-w-0 flex-1 border-none bg-transparent px-3 py-[10px] text-[12.5px] text-field-fg outline-none"
          />
          <button
            onClick={submit}
            disabled={status.kind === "submitting"}
            className="whitespace-nowrap bg-accent px-[15px] text-[12.5px] font-bold text-white disabled:opacity-60"
          >
            {status.kind === "submitting" ? "…" : "Đăng ký"}
          </button>
        </div>
        {invalid && (
          <p role="alert" className="mt-2 text-[11.5px] font-semibold text-red-400">
            {status.message}
          </p>
        )}
        <p className="mt-2 font-mono text-[10px] text-ink-muted">Không spam. Huỷ bằng 1 click.</p>
      </>
    );

  if (variant === "rail") {
    return (
      <div className="mt-7 rounded-xl border-t-2 border-accent bg-ink p-[18px] text-ink-fg">
        <div className="mb-[5px] font-display text-[16px] font-bold leading-[1.15]">Bản tin Mạch</div>
        <p className="mb-3 text-[11.5px] leading-[1.5] text-ink-muted">{BENEFIT}</p>
        {form}
      </div>
    );
  }
  return <div>{form}</div>;
}
```

- [ ] **Step 4: Chạy toàn bộ test** — Run: `pnpm --filter @ultimate/web test` → PASS (test mới + cũ; sửa test cũ nào assert placeholder `"email…"`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/magazine/components/newsletter-box.tsx apps/web/src/features/magazine/components/newsletter-box.test.tsx
git commit -m "feat(web): redesign NewsletterBox — form liền khối, success/error inline, microcopy"
```

---

### Task 7: Stable callbacks — sửa re-render

**Files:**
- Modify: `apps/web/src/features/magazine/components/magazine-board.tsx:28-47`
- Modify: `apps/web/src/features/magazine/components/article-list.tsx:34-42`
- Modify: `apps/web/src/features/magazine/components/article-row.tsx:20` (thêm contain-intrinsic-size)

**Interfaces:**
- Consumes: `memo` components hiện có (`ArticleRow`, `TopViewedList`).
- Produces: callback `openArticle: (slug: string) => void` ổn định qua `useCallback`.

- [ ] **Step 1: `magazine-board.tsx` — useCallback cho onOpen**

```tsx
import { useCallback } from "react";
// trong component:
const openArticle = useCallback((slug: string) => router.push(`/blog/${slug}`), [router]);
// và:
<TopViewedList items={topViewed} onOpen={openArticle} />
```

- [ ] **Step 2: `article-list.tsx` — tương tự**

```tsx
import { useCallback, useDeferredValue, useMemo } from "react";
// trong component:
const openArticle = useCallback((slug: string) => router.push(`/blog/${slug}`), [router]);
// và trong map:
<ArticleRow key={a.id} article={a} index={i} saved={Boolean(saved[a.id])} onToggleSave={toggleSave} onOpen={openArticle} />
```

- [ ] **Step 3: `article-row.tsx` — bổ sung intrinsic size cho content-visibility**

Class của `<article>` thêm `[contain-intrinsic-size:auto_129px]` cạnh `[content-visibility:auto]`.

- [ ] **Step 4: Test** — Run: `pnpm --filter @ultimate/web test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/magazine/components/magazine-board.tsx apps/web/src/features/magazine/components/article-list.tsx apps/web/src/features/magazine/components/article-row.tsx
git commit -m "perf(web): stable useCallback cho onOpen — memo ArticleRow/TopViewedList có hiệu lực thật"
```

---

### Task 8: Animation framer-motion (LazyMotion + m.)

**Files:**
- Modify: `apps/web/package.json` (thêm `framer-motion`)
- Modify: `apps/web/src/features/magazine/components/magazine-board.tsx` (bọc LazyMotion/MotionConfig)
- Modify: `apps/web/src/features/magazine/components/article-row.tsx` (fade-up)
- Modify: `apps/web/src/features/magazine/components/auth-modal.tsx` (fade+scale in)
- Modify: `apps/web/src/features/magazine/components/toast.tsx` (slide-in)
- Modify: `apps/web/src/test/setup.ts` (mock IntersectionObserver)

**Interfaces:**
- Consumes: cây client island `MagazineBoard`.
- Produces: mọi `m.` component phải nằm dưới `<LazyMotion strict>` trong `MagazineBoard`.

- [ ] **Step 1: Cài framer-motion**

Run: `pnpm --filter @ultimate/web add framer-motion`
Expected: thêm `framer-motion` vào dependencies.

- [ ] **Step 2: Mock IntersectionObserver trong `src/test/setup.ts`** (jsdom không có — `whileInView` cần):

```ts
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
// @ts-expect-error — stub cho jsdom
globalThis.IntersectionObserver ??= IO;
```

- [ ] **Step 3: Bọc `MagazineBoard`**

```tsx
import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
// return:
return (
  <MotionConfig reducedMotion="user">
    <LazyMotion features={domAnimation} strict>
      <Masthead />
      {/* … phần còn lại giữ nguyên … */}
    </LazyMotion>
  </MotionConfig>
);
```

- [ ] **Step 4: `article-row.tsx` — fade-up khi vào viewport**

```tsx
import { m } from "framer-motion";
// đổi <article> → <m.article>, giữ nguyên onClick/className/style, thêm:
<m.article
  initial={{ opacity: 0, y: 12 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-40px" }}
  transition={{ duration: 0.3, ease: "easeOut", delay: Math.min(index, 5) * 0.05 }}
  …
>
```

- [ ] **Step 5: `auth-modal.tsx` — fade + scale in**

Overlay `<div onClick={close} …>` → `<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }} …>`; panel `<div onClick={stopPropagation} …>` → `<m.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22, ease: "easeOut" }} …>` (thêm `import { m } from "framer-motion";`).

- [ ] **Step 6: `toast.tsx` — slide-in**

```tsx
import { m } from "framer-motion";
// đổi div → m.div, thêm:
initial={{ opacity: 0, y: 16 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.22, ease: "easeOut" }}
```

- [ ] **Step 7: Test + build**

Run: `pnpm --filter @ultimate/web test` → PASS. Run: `pnpm --filter @ultimate/web build` → xanh; kiểm tra First Load JS trang `/` tăng ≤ ~10KB so với trước (in ra trong output build).

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/test/setup.ts apps/web/src/features/magazine/components/magazine-board.tsx apps/web/src/features/magazine/components/article-row.tsx apps/web/src/features/magazine/components/auth-modal.tsx apps/web/src/features/magazine/components/toast.tsx
git commit -m "feat(web): animation framer-motion (LazyMotion+m) — fade-up rows, modal scale, toast slide"
```

---

### Task 9: Docs — quy ước CodeGraph + cập nhật tiến độ

**Files:**
- Modify: `CLAUDE.md` (mục "Quy ước làm việc" + "Trạng thái hiện tại" + 📍)

**Interfaces:** không có code.

- [ ] **Step 1: Thêm quy ước vào `CLAUDE.md` mục "Quy ước làm việc"**

```markdown
- **Khảo sát code:** luôn ưu tiên **CodeGraph** (`codegraph_explore` / `codegraph explore`) trước grep/Read khi tìm hiểu hoặc định vị code — một call trả về source + call path + blast radius.
```

- [ ] **Step 2: Thêm dòng Slice 7 DONE vào "Trạng thái hiện tại" + cập nhật 📍** (viết sau khi verify E2E xong — nội dung theo kết quả thật).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: quy ước ưu tiên CodeGraph + tiến độ Slice 7"
```

---

### Task 10: Verify tổng — build production + E2E live

**Files:** không sửa code (chỉ fix nếu phát hiện lỗi).

- [ ] **Step 1: Toàn bộ test + build**

Run: `pnpm --filter @ultimate/web test` → toàn bộ PASS (56 cũ + mới).
Run: `pnpm --filter @ultimate/web build` → xanh, routes static giữ nguyên.

- [ ] **Step 2: E2E live** (core + web chạy theo README):

- `/` light + dark: masthead/subnav/footer cùng tông, không còn băng xanh; mép nội dung masthead thẳng hàng feed ở 1440px+.
- Newsletter rail + footer: email sai → lỗi inline đỏ + aria-invalid; email đúng → "✓ Đã đăng ký — hẹn bạn thứ Hai!".
- Animation: rows fade-up 1 lần; bật OS reduce-motion → không animation.
- Search/bookmark/auth modal không regression; font Playfair render đúng tiếng Việt có dấu.

- [ ] **Step 3: Hoàn tất docs tiến độ (Task 9 Step 2) và commit cuối**
