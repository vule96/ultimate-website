# Slice 15 — Next 16 + React 19 + next-intl v4 (full modernization) — Design

**Ngày:** 2026-07-18
**Trạng thái:** Approved (brainstorm) → implement
**Bối cảnh:** Slice 14 (CI/CD) baseline `.trivyignore.yaml` 5 CVE Next.js 14 (HIGH), hạn 2026-09-15. Slice này vá bằng cách nâng major toàn bộ FE.

## 1. Mục tiêu & scope

- Vá 5 CVE Next 14 → **gỡ `.trivyignore.yaml`** (Trivy xanh không cần ignore).
- web: **Next 14→16.2.10 + React 18→19.2 + next-intl v3→v4**.
- admin: **React 18→19** (Vite).
- `packages/ui`: peer **React 19**.
- **ESLint flat config** cho web + đưa lint job web vào CI (Next 16 bỏ lệnh `next lint`).
- Verify CI xanh toàn bộ + E2E live web + admin.

### Compat đã xác nhận (npm peer)
- Next 15 và 16 đều peer `react: ^18.2 || ^19` — React 19 không bắt buộc, nhưng slice này chọn full 19.
- next-intl v4 peer next `^12..^16`, react `..^18 || ^19`.
- radix, TanStack router/query/table, framer-motion 12, testing-library 16 — đều `^18 || ^19`.
- Codebase web đã dùng API next-intl mới (`createNavigation`, `defineRouting`, `getRequestConfig`) → migration v4 nhỏ.

### Bề mặt (khảo sát)
- 10 file dùng `params`/`searchParams` (async ở Next 15+).
- 36 file import next-intl; `src/i18n/{routing,navigation,request}.ts` + `src/middleware.ts`.
- 7 file `forwardRef`/`React.FC` (React 19 giữ chạy, types nghiêm hơn).

## 2. Kiến trúc: 7 phase (mỗi phase verify + commit riêng, merge tăng dần được)

### P1 — `packages/ui` nền React 19
- peer `react`/`react-dom` → `^19` (giữ `^18.2 || ^19` để an toàn nếu cần); devDeps `@types/react`/`@types/react-dom` → `^19`.
- Fix type nếu vỡ. **Verify:** `pnpm --filter @ultimate/ui exec tsc --noEmit` + build.

### P2 — web deps bump
- `next@^16.2.10`, `react@^19.2`, `react-dom@^19.2`, `@types/react@^19`, `@types/react-dom@^19`, `next-intl@^4`.
- Giữ framer-motion 12, zustand 5, testing-library 16. `pnpm install --frozen-lockfile=false` (lockfile đổi).

### P3 — web code migration (nặng nhất)
- **async request APIs:** codemod `npx @next/codemod@latest next-async-request-api .` + sửa tay. Mọi `params.locale`/`searchParams` → `await`; `setRequestLocale((await params).locale)`. ~10 file: `app/[locale]/{layout,page}.tsx`, `blog/[slug]`, `tags/[slug]`, `page/[n]`, `sitemap.ts`, `rss.xml/route.ts` (nếu dùng params).
- **next-intl v4:** `getRequestConfig` trả `{ locale, messages }` (locale bắt buộc); `NextIntlClientProvider` truyền `locale` + `messages`; kiểm `defineRouting`/`createNavigation`/middleware matcher theo [migration v4](https://next-intl.dev/docs/upgrade). Regenerate `messages.d.ts` nếu cần.
- **caching Next 15+:** `fetch` không cache mặc định — rà mỗi fetch trong RSC, giữ ISR bằng `export const revalidate = 60` + `dynamic`/`force-static` chỗ cần. Verify SSG (`/` vs `/page/2` khác nhau, build ra static).
- **React 19 types:** fix churn `@types/react` 19 (JSX namespace, `useRef` cần arg, `ReactNode`), forwardRef giữ (không bắt buộc đổi ref-as-prop trong slice này).
- **Giữ nguyên & verify:** CSP header (`next.config.mjs`), next/image, next/font, blurhash.

### P4 — ESLint flat config web + CI
- Cài `eslint@^9`, `eslint-config-next@^16`, `@eslint/eslintrc` (nếu cần compat). Tạo `apps/web/eslint.config.mjs` (flat, extends next core-web-vitals).
- Script `apps/web` `"lint": "eslint ."` (thay `next lint`).
- **Dọn lint error** lộ ra từ code Slice 6–12 (fix hoặc disable có chủ đích với comment).
- CI: web job đưa lại `lint` vào `pnpm turbo run lint test build --filter=@ultimate/web...` (Slice 14 đã bỏ vì chưa có ESLint).

### P5 — web verify
- `pnpm --filter @ultimate/web test` (vitest, testing-library 16 + React 19).
- `pnpm --filter @ultimate/web build`: Next 16 mặc định **Turbopack** — thử; nếu vỡ (rehype/unified SSR, CSP, standalone) fallback `next build --webpack`, note lý do.
- Production `next build && next start` E2E live: home `/` (vi) + `/en` (chrome en, bài vi), blog detail + related, `/tags` + `/tags/[slug]` + `/page/[n]`, sitemap/rss/robots, hreflang, bookmark + auth Google (BFF), i18n switcher giữ pathname, blurhash/CLS 0, newsletter.

### P6 — admin React 19
- bump `react`/`react-dom`/`@types` → 19 trong `apps/admin`.
- Verify TanStack router/query/table version support 19 (bump patch/minor nếu peer cảnh báo).
- Fix type + forwardRef.
- **Verify (quy ước đồng bộ admin):** `pnpm --filter @ultimate/admin exec tsc --noEmit` + `build` + `test` (39). E2E live admin: login BFF, list/filter/search posts, tạo/sửa/xoá, editor Tiptap, dashboard stats/chart, media presign.

### P7 — CI + security + docs + merge
- **Gỡ `.trivyignore.yaml`** (5 CVE Next đã vá bởi Next 16). Xác nhận Trivy fs scan xanh không ignore.
- Full CI xanh: changes/core/web(+lint)/admin/security.
- govulncheck (core) vẫn xanh (không đổi core).
- Cập nhật `CLAUDE.md` (mục trạng thái + 📍 điểm hiện tại) + `docs/reviews/...` nếu có finding.
- Nhận xét chuyên gia (0.1% FE) cuối slice.
- PR → verify CI xanh → merge → release.

## 3. Test strategy
- Regression: suite hiện có (web ~101 / admin 39 / ui 3) phải xanh sau mỗi phase liên quan.
- TDD nơi đổi hành vi thật: helper async params, next-intl v4 config guard, ESLint config.
- Verify E2E live BẮT BUỘC cả web + admin (không chỉ web).

## 4. Rủi ro & giảm thiểu
- **Turbopack build** khác webpack (rehype/unified, CSP, standalone Docker) → fallback `--webpack`, giữ Docker web build xanh.
- **next-intl v4** SSG/`setRequestLocale` regressions → verify hreflang + SSG `/` vs `/en`.
- **@types/react 19** churn 3 package → fix tuần tự P1→P2→P6.
- **admin** runtime regressions (TanStack) → E2E admin đầy đủ, không chỉ typecheck.
- **framer-motion 12 + React 19** strict-effects double-invoke (dev) → verify animation không nhân đôi/toast.
- **Docker image FE** build lại với deps mới → verify `docker compose -f docker-compose.prod.yml build web admin`.

## 5. Ngoài scope (backlog)
- Migrate forwardRef → ref-as-prop (React 19 khuyến nghị nhưng không bắt buộc).
- React Compiler (`babel-plugin-react-compiler`) — để sau.
- web `NEXT_PUBLIC_API_URL` build-arg (nợ Slice 14) — thêm nếu tiện khi chạm Docker/CI.

## 6. Nhận xét chuyên gia (0.1% FE)

Kết quả: full workspace 8/8 turbo task xanh (ui/web/admin × lint/test/build), web 101 + admin 39 + ui 3 test xanh, tsc 0 lỗi cả 3 package, Docker web (Next 16 standalone) + admin (nginx-unprivileged) build xanh. Migration nhỏ hơn dự kiến vì codebase đã dùng API next-intl mới + peer deps đều hỗ trợ React 19.

**Điểm cần biết / nợ:**
- **pnpm overrides ép react/react-dom/@types 19 toàn workspace** — nền tảng cho single-instance. Bản react 18.3.1 vẫn còn trong tree (transitive lạc, không nằm trong build path). Nếu sau này thêm package cần react 18 sẽ vỡ — override là hàng rào cứng.
- **Turbopack build mặc định (Next 16)** chạy tốt với rehype/unified SSR + CSP + standalone — KHÔNG cần fallback webpack. Nhưng chưa benchmark so webpack; nếu prod gặp khác biệt output, cờ `next build --webpack` là lối thoát.
- **12 ESLint warning còn lại** (`<a href="/">` ở masthead-board/footer nên dùng `<Link>`; `<img>` trong test) — không chặn, để backlog polish. `<a>` cho home thực sự nên chuyển `Link` (mất client-side nav + prefetch).
- **next-intl v4** chỉ cần thêm `locale` prop cho provider — vì codebase đã ở v3.26 API mới. Nếu về sau dùng thêm API v4 (vd `Locale` type, `hasLocale`) thì tận dụng.
- **React 19 rule mới `react-hooks/set-state-in-effect`** bắt 1 ca hợp lệ (use-theme đọc DOM sau mount) — đã disable có justification. Đáng cân nhắc `useSyncExternalStore` cho theme ở slice polish.
- **Chưa E2E live** trong lúc code (build+test tĩnh xanh). Verify live cuối cùng (stack thật core+redis) là bước còn lại — quan trọng nhất là kiểm next-intl SSG hreflang + bookmark/auth BFF + admin editor runtime dưới React 19.
- Nợ Slice 14 chưa đụng: `NEXT_PUBLIC_API_URL` build-arg web.
