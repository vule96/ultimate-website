# Slice 5a — Security & Data-loss Hardening (Đợt 1)

> Ngày: 2026-07-11 · Trạng thái: Design approved, chờ implementation plan.
> Nguồn findings: `docs/reviews/2026-07-11-senior-code-review.md` (issue tracker). Slice này resolve: **C1, H1, H4, A1, A4** (+ L11 một phần, qua startup assertion).
> Quyết định đã chốt khi brainstorm: (1) phạm vi = chỉ đợt 1; (2) C1 fix theo hướng **session-aware endpoint** (giữ nguyên URL, không tách route admin riêng).

## Mục tiêu

Đóng toàn bộ lỗ hổng bảo mật + bug mất dữ liệu nghiêm trọng nhất trước khi làm bất kỳ việc gì khác:

1. **C1** — API public không được lộ bài DRAFT/PENDING_APPROVAL (kể cả stats).
2. **A1 + A4** — Form sửa bài không bị background refetch ghi đè; editor keystroke không re-render cả form.
3. **H1** — Presigned PUT phải enforce giới hạn 5 MB thật (ký Content-Length).
4. **H4** — Chặn CSRF class khi cookie `SameSite=none` (requireJSON) + fail-fast config không hợp lệ.

**Ngoài phạm vi (đợt 2 + 3, slice sau):** graceful shutdown/timeouts, request logging, 401-aware admin pipeline, path-based pagination web, SEO, sanitize/CSP, outbox, và mọi finding M/L khác.

## Thiết kế

### 1. Core — Visibility policy (C1)

**Nguyên tắc:** quyết định "authed hay không" nằm ở transport (handler/wiring); service chỉ nhận `bool`. Module `posts` KHÔNG import module `auth` — nhận một checker function qua wiring.

**Thay đổi:**

- `internal/modules/auth`: thêm helper exported
  ```go
  // Identity trả về checker cho biết request hiện tại đã đăng nhập chưa.
  func Identity(sm *scs.SessionManager) func(ctx context.Context) bool
  ```
  (đọc `sessionKeyAdminEmail` — giữ key unexported trong auth.)
- `internal/modules/posts/handler.go`:
  - `NewHandler(svc *Service, authed func(ctx context.Context) bool) *Handler` — lưu checker.
  - `list`: set `ListFilter.Authed = h.authed(c.Request.Context())`.
  - `getBySlug`: gọi `h.svc.GetBySlug(ctx, slug, authed)`.
  - **Route `GET /posts/stats` + `GET /posts/stats/timeseries` chuyển vào group `write` (sau `RequireAuth`)** — đây là data dashboard. Nhóm `write` đổi tên biến thành `protected` cho đúng nghĩa.
- `internal/modules/posts/service.go`:
  - `ListFilter` thêm field `Authed bool`.
  - `List`: nếu `!f.Authed` → **ép `f.Status = string(StatusPublished)`** bất kể input (ghi đè, không reject).
  - `GetBySlug(ctx, slug string, authed bool)`: nếu `!authed` và `post.Status != StatusPublished` → trả `ErrPostNotFound` (404 — không lộ tồn tại của slug).
- `cmd/api/main.go`: `posts.NewHandler(posts.NewService(...), auth.Identity(sm))`.
- **Web/admin FE: không đổi gì.** Web giữ filter PUBLISHED client-side làm belt-and-braces (`apps/web/src/features/posts/api.ts:34-39`). Admin đã gửi `credentials: 'include'` nên stats sau RequireAuth vẫn hoạt động.

**Lưu ý:** `GET /tags` giữ public (web dùng cho `/tags`; danh sách tag không nhạy cảm).

### 2. Core — Presign size (H1)

- `internal/modules/media/domain.go`: port đổi signature
  ```go
  PresignPut(ctx context.Context, key, contentType string, size int64) (url string, expires time.Duration, err error)
  ```
- `internal/modules/media/storage_s3.go`: set `ContentLength: aws.Int64(size)` vào `PutObjectInput` → Content-Length thành **signed header**; PUT với size khác bị storage từ chối (403 SignatureDoesNotMatch).
- `internal/modules/media/service.go`: truyền `in.Size` xuống (validation `Size <= MaxUploadSize` đã có sẵn, giữ nguyên).
- Cập nhật mock/stub trong `service_test.go` + `storage_s3_test.go` theo signature mới.
- **FE admin (`features/media/api.ts`): kiểm tra client gửi đúng Content-Length** — trình duyệt tự set từ body PUT, không cần đổi code; chỉ verify E2E (MinIO chấp nhận upload đúng size, từ chối khi khai size sai — test bằng curl).

### 3. Core — requireJSON + config assertion (H4, L11 một phần)

- `internal/shared/jsonmw/jsonmw.go` (package mới, cùng kiểu `corsmw`):
  ```go
  // RequireJSON chặn request có body mà Content-Type không phải application/json → 415.
  func RequireJSON() gin.HandlerFunc
  ```
  - Chỉ áp cho method có body (POST/PUT/PATCH). Chấp nhận `application/json` + suffix charset (`application/json; charset=utf-8`). DELETE/GET bỏ qua.
  - Response lỗi dùng `httperr.Write(c, 415, "UNSUPPORTED_MEDIA_TYPE", ...)` cho nhất quán envelope.
- Wiring: thêm `jsonmw.RequireJSON()` vào chuỗi `writeMW` ở `main.go` cho cả posts lẫn media (trước `RequireAuth`).
- `internal/platform/config/config.go`: cuối `Load()` thêm assertion
  ```go
  if cfg.SessionSameSite == "none" && !cfg.SessionSecure {
      return Config{}, fmt.Errorf("config: SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true")
  }
  ```
  (so sánh sau khi lowercase/trim input.)

### 4. Admin — Form data-loss (A1 + A4)

`apps/admin/src/features/posts/PostFormPage.tsx`:

- **A1:** thêm `const hasHydratedRef = useRef(false)`; effect prefill chỉ chạy khi `loaded && !hasHydratedRef.current`, sau đó set `hasHydratedRef.current = true`. Background refetch về sau không `reset()` nữa. (Chọn ref thay vì `staleTime: Infinity` để không đổi hành vi cache toàn cục; thay vì `isDirty` vì editor set `shouldDirty` theo keystroke — ref đơn giản và đúng ngữ nghĩa "hydrate một lần".)
- **A4:** `const contentJsonRef = useRef<unknown>({})` thay cho `useState`; editor `onChange` ghi `contentJsonRef.current = json` (không re-render); prefill ghi `contentJsonRef.current = loaded.content_json ?? {}`; `onSubmit` đọc `contentJsonRef.current`.
- `initialHtml` của `EditorSwitch` đổi sang giá trị chốt lúc hydrate (đọc từ lần load đầu) để nhất quán với form đã freeze — editor là uncontrolled nên chỉ dùng lúc mount, nhưng tránh phụ thuộc `loaded` object mới sau refetch.

## Test plan (TDD — test trước, code sau)

**Core (Go):**
| Test | Khẳng định |
|---|---|
| `handler_test`: anonymous `GET /posts?status=DRAFT` | chỉ trả bài PUBLISHED (filter bị ép) |
| `handler_test`: anonymous `GET /posts/:slug` bài DRAFT | 404 `POST_NOT_FOUND` |
| `handler_test`: authed `GET /posts?status=DRAFT` | thấy bài DRAFT |
| `handler_test`: authed `GET /posts/:slug` bài DRAFT | 200 |
| `handler_test`: `GET /posts/stats` không session | 401 |
| `service_test`: `List` với `Authed=false` + `Status="DRAFT"` | filter xuống repo là PUBLISHED |
| `media/service_test`: presign truyền size xuống storage mock | mock nhận đúng `size` |
| `media/storage_s3_test`: presigned URL chứa `content-length` trong signed headers | `X-Amz-SignedHeaders` có `content-length` |
| `jsonmw_test`: POST `text/plain` → 415; `application/json; charset=utf-8` → pass; GET không body → pass | |
| `config_test`: `samesite=none` + `secure=false` → error; `none`+`secure=true` → ok | |

**Admin (Vitest + Testing Library):**
| Test | Khẳng định |
|---|---|
| `PostFormPage`: data load lần 1 → form prefill | giá trị đúng |
| `PostFormPage`: query trả object mới (mô phỏng refetch) sau khi user sửa title | form GIỮ giá trị user, không bị reset |
| `PostFormPage`: submit sau khi editor onChange | payload chứa đúng `content_json` mới nhất |

**Verify E2E (stack thật, dev):**
1. `curl` anonymous: `GET /api/v1/posts?status=DRAFT` → chỉ PUBLISHED; slug bài DRAFT → 404; `GET /api/v1/posts/stats` → 401.
2. Login admin → posts list vẫn thấy draft, Dashboard stats vẫn chạy.
3. Sửa bài: gõ nội dung, chờ >30s (staleTime) + trigger refetch (blur/focus tab) → nội dung không mất; save → đúng nội dung.
4. Upload ảnh qua admin (MinIO) vẫn OK; PUT với size khai sai bằng curl → bị từ chối.
5. POST `/api/v1/posts` với `Content-Type: text/plain` → 415.

## Definition of Done

- Toàn bộ test xanh (core + admin), build 3 target xanh.
- Verify E2E 5 mục trên pass.
- Chạy `security-review` cho diff.
- Đánh dấu `✅ RESOLVED (2026-07-11, commit <hash>)` cho C1, H1, H4, A1, A4 trong `docs/reviews/2026-07-11-senior-code-review.md`.
- Cập nhật `CLAUDE.md` ("Trạng thái hiện tại" + khối Issue tracker: 3 việc khẩn còn lại chỉ W1).
