# Backlog phần 3 — Nợ admin (7 mục) — Design

**Ngày:** 2026-07-20. Nguồn: `docs/backlog-admin-e2e-tech.md` mục (3).
Phạm vi đợt này: **3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8** (bỏ 3.7 dark mode).

## Mục tiêu

Trả 7 nợ admin: unsubscribe flow, GDPR delete reader, ⌘K search bài thật, count cache, soft-delete subscriber, topbar context theo trang, code-split bundle.

## Quyết định chốt

1. **Unsubscribe = POST-confirm**, không GET one-click → tránh email-client prefetch tự huỷ. Web page render nút xác nhận, POST core.
2. **Count cache TTL-only 30s, fail-open**, không bump-on-write → chấp nhận stale ≤30s, khỏi luồn invalidation qua mọi write path.
3. **Re-subscribe hồi sinh row cũ** (chỉ soft-deleted): `UpsertSubscriber` `ON CONFLICT DO UPDATE SET deleted_at=NULL, status='active' WHERE status <> 'unsubscribed'`. **Consent (fix security review):** endpoint public → KHÔNG reactivate row `unsubscribed` (opt-out rõ ràng) để tránh bất kỳ ai re-subscribe người đã huỷ. Chỉ hồi sinh row admin soft-delete.

## A. BE schema — migration `add_subscriber_lifecycle`

`subscribers` thêm (3.1 + 3.5 cùng bảng → 1 migration):
- `unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid()` + `CREATE UNIQUE INDEX idx_subscribers_unsub_token`.
- `deleted_at timestamptz NULL`.

`subscriberRow` (model.go) + domain `Subscriber` thêm `UnsubscribeToken uuid.UUID`, `DeletedAt *time.Time`. Gorm tag khớp.

## B. 3.1 Unsubscribe

- **Repo**: `UnsubscribeByToken(ctx, token uuid.UUID) error` → `UPDATE subscribers SET status='unsubscribed' WHERE unsubscribe_token=? AND deleted_at IS NULL`; 0 rows → `ErrSubscriberNotFound`. `UpsertSubscriber` đổi sang `ON CONFLICT (email) DO UPDATE SET deleted_at=NULL, status='active'` (hồi sinh).
- **Service**: `Unsubscribe(ctx, token uuid.UUID) error`.
- **Endpoint**: `POST /subscribers/unsubscribe` body `{token}` — public, rate-limited (dùng chung mw subscribe), `RequireJSON`. Token sai/thiếu → 404. OK → 204.
- **Web** `apps/web/.../unsubscribe`: route `/[locale]/unsubscribe` (hoặc gốc, giữ i18n). Server component đọc `?token=`; client component nút "Huỷ đăng ký" → POST `PUBLIC_API_URL/api/v1/subscribers/unsubscribe` → hiện success/invalid. Newsletter footer + tương lai email chèn link `WEB_BASE_URL/unsubscribe?token=<token>`.
- **Admin**: `ListSubscribers` nhận `status` filter (`""|active|unsubscribed`); admin list thêm select filter. Cột Status hiện `unsubscribed` (label "Đã huỷ").

## C. 3.2 GDPR delete reader

- **Repo**: `DeleteReader(ctx, id) error` → `DELETE FROM readers WHERE id=?` (bookmarks cascade FK). 0 rows → `ErrReaderNotFound`.
- **Service**: `DeleteReader(ctx, id)`.
- **Endpoint**: `DELETE /auth/reader/me` sau `RequireReader` → `svc.DeleteReader` → `sm.Remove(SessionKeyReaderID)` + `RenewToken` → 204.
- **Web**: store `deleteAccount(): Promise<void>` (DELETE `credentials:include`, clear `user`+`saved`, toast key mới `accountDeleted`). `auth-menu` thêm nút "Xoá tài khoản" → confirm dialog (reuse mẫu modal) → `deleteAccount`. i18n `deleteAccount`, `deleteAccountConfirm`, `accountDeleted` vi+en.

## D. 3.4 Count cache

Inject `redis.Cmdable` (nil-safe) vào `readersSvc` qua `WithCountCache(rdb)`. Trong `ListSubscribers`/`ListReaders` service: đọc key `subscribers:count:<status>` / `readers:count` (GET → parse int); miss/redis-nil/lỗi → gọi repo count thật + `SET ... EX 30`. Fail-open. Repo trả `(rows, total)` như cũ; wrapper cache ở tầng service.

## E. 3.5 Soft-delete subscriber

- `DeleteSubscriber` repo → `UPDATE subscribers SET deleted_at=now() WHERE id=? AND deleted_at IS NULL`; 0 rows → `ErrSubscriberNotFound`.
- `ListSubscribers` + count filter `deleted_at IS NULL` (+ status filter từ 3.1).

## F. 3.3 ⌘K search bài

`CommandPalette.tsx`: giữ COMMANDS tĩnh. Khi `q.trim()` không rỗng → thêm section "Bài viết": debounce 250ms (`useDeferredValue` hoặc timeout) → `useQuery({queryKey:['cmdk-posts',q], queryFn: listPosts({q, pageSize:5}), enabled: q.length>0})`. Render dưới nav, item navigate `{to:'/posts/$slug/edit', params:{slug: p.slug}}`. Loading/empty state. Điều hướng phím gộp cả 2 nhóm.

## G. 3.6 Topbar context

- Bỏ nút Bell.
- **Portal slot**: `Topbar` render `<div ref={slotRef} className="flex gap-3" />` trước nút "Thêm bài viết"; expose node qua context `TopbarSlotContext`. Component `<TopbarActions>{children}</TopbarActions>` = `createPortal(children, node)`.
- `SubscribersPage` chuyển nút "Xuất CSV" vào `<TopbarActions>`. Giữ nút "Thêm bài viết" mặc định trên mọi trang.

## H. 3.8 Code-split

`apps/admin/vite.config.ts`: `build.rollupOptions.output.manualChunks` tách `react`+`react-dom`, `@tanstack/react-router`, `@tanstack/react-query`. Lazy dashboard chart (`PostsChart`) qua `React.lazy` + `Suspense` fallback. Đo bằng output `vite build` (không thêm dep).

## Types (`packages/types`)

`SubscriberSchema` thêm `unsubscribe_token?`/không (server không trả token ở list admin — giữ nguyên response, chỉ status đủ). Không đổi schema list nếu BE response giữ `{id,email,status,created_at}`. Nếu thêm status filter param → chỉ đổi client query, không đổi schema.

## Verify

- **Go** `go test ./...` (blog_test): repo test unsubscribe (token đúng→unsub, sai→404), soft-delete ẩn khỏi list + count, re-subscribe hồi sinh, `DeleteReader` cascade bookmark; admin_handler status filter; service count-cache (miss→set, hit→skip repo với fake).
- **Admin**: `tsc --noEmit` + `build` + test (⌘K search, topbar portal).
- **Web**: `tsc` + `build` + test (unsubscribe page, deleteAccount store, auth-menu delete button).
- **Rebuild cả `core` lẫn `admin` image** trước E2E (core stale trap 2026-07-20).

## Nợ để lại

- Email gửi thật (link unsubscribe) — Phase 2 (chưa có mailer). Chỉ chèn link vào footer web + chuẩn bị token.
- Reader profile page đầy đủ (chỉ có delete, chưa có sửa) — Phase 2.
