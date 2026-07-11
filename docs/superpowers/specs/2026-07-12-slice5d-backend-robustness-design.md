# Slice 5d — Backend Robustness (Đợt 4)

> Ngày: 2026-07-12 · Trạng thái: Design approved, chờ implementation plan.
> Nguồn findings: `docs/reviews/2026-07-11-senior-code-review.md` (issue tracker). Slice này resolve: **M1, M2, M3, M4, M5** + hạng mục **outbox** (chuẩn bị Phase 2, mục "Kiến trúc cho Phase 2" trong review).
> Quyết định đã chốt khi brainstorm: (1) hướng đi = Slice 5d (không phải deploy/Phase 2); (2) M3 fix theo hướng **dời route sang `/stats/posts`** (không reserve slug); (3) M5 làm **trọn end-to-end** (core + admin FE, version bắt buộc); (4) outbox **mức B**: bảng + ghi event trong transaction + dispatcher poll với handler pluggable (mặc định log).

## Mục tiêu

Đóng toàn bộ finding Medium còn lại của core + đặt nền event cho Phase 2 (AI worker):

1. **M1** — Tạo tag concurrent không còn race/409 sai; save post ít round-trip hơn.
2. **M2** — Gỡ email khỏi `ADMIN_ALLOWLIST` có hiệu lực ngay (không đợi session 7 ngày).
3. **M3** — Bài viết slug `stats` (hoặc bất kỳ slug nào) không bị route tĩnh che.
4. **M4** — Write endpoint có giới hạn body size (413 khi vượt).
5. **M5** — Hết lost-update: 2 writer concurrent → writer sau nhận 409, admin FE hiển thị conflict rõ ràng.
6. **Outbox** — Mọi thay đổi post để lại event trong bảng `outbox` cùng transaction; dispatcher poll sẵn sàng để Phase 2 cắm consumer thật.

**Ngoài phạm vi:** consumer outbox thật (AI worker — Phase 2), deploy production, mọi finding L còn lại không thuộc M1–M5.

## Thiết kế

### 1. Core — M1: Tag upsert bằng `ON CONFLICT` (batch)

`internal/modules/posts/repository.go`:

- Thay `upsertTags` (vòng lặp `FirstOrCreate` — SELECT-then-INSERT, dính race unique-violation + N round-trip) bằng **một** lệnh batch:

  ```go
  tx.Clauses(clause.OnConflict{
      Columns:   []clause.Column{{Name: "slug"}},
      DoUpdates: clause.AssignmentColumns([]string{"name"}),
  }).Create(&gormTags)
  ```

  `DO UPDATE SET name = excluded.name` (thay vì `DO NOTHING`) để Postgres luôn RETURNING id — GORM điền ID cho cả dòng đã tồn tại.
- **Thu hẹp scope `translateErr`**: chỉ áp cho insert/update của *post* (map unique-violation → `ErrSlugTaken`); lỗi từ tag upsert trả nguyên trạng (sau fix này tag không còn sinh unique-violation trong luồng bình thường).
- Trường hợp `tags` rỗng: bỏ qua upsert (GORM `Create` với slice rỗng là lỗi).

### 2. Core — M2: RequireAuth re-check allowlist

`internal/modules/auth/middleware.go`:

- Đổi chữ ký: `RequireAuth(sm *scs.SessionManager, allowlist *Allowlist) gin.HandlerFunc`.
- Mỗi request: lấy email từ session; nếu rỗng → 401 (như cũ). Nếu có email nhưng `!allowlist.IsAllowed(email)` → `sm.Destroy(ctx)` rồi trả **401 UNAUTHORIZED** (không dùng 403 — session này không còn giá trị, admin FE đã có pipeline redirect login theo 401 từ Slice 5b).
- `cmd/api/main.go`: allowlist hiện tạo inline trong `NewService` — tách ra biến `allowlist := auth.NewAllowlist(cfg.AdminAllowlist)` dùng chung cho `NewService` và `RequireAuth`.

### 3. Core + Admin — M3: dời stats routes sang `/stats/posts`

- `internal/modules/posts/handler.go` `RegisterRoutes`:
  - `protected.GET("/posts/stats", h.stats)` → `protected.GET("/stats/posts", h.stats)`
  - `protected.GET("/posts/stats/timeseries", h.timeseries)` → `protected.GET("/stats/posts/timeseries", h.timeseries)`
  - Dưới `/posts/` chỉ còn `GET /posts/:slug` động + write theo `:id` → hết shadowing, mọi slug hợp lệ.
- Admin FE `apps/admin/src/features/posts/api.ts:64,68`: đổi 2 URL tương ứng (`/api/v1/stats/posts`, `/api/v1/stats/posts/timeseries`).
- Không giữ URL cũ (không alias/redirect) — admin là client duy nhất và sửa cùng commit.

### 4. Core — M4: giới hạn body size

- `internal/platform/config`: thêm `MaxBodyBytes int64` từ env `MAX_BODY_BYTES`, default **2 MiB** (2097152). Đủ cho `content_html` bài dài; ảnh đi đường presign, không qua core.
- Middleware global (đặt trong `internal/shared/bodylimit`, cùng kiểu `corsmw`/`jsonmw`):

  ```go
  func Middleware(maxBytes int64) gin.HandlerFunc // c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
  ```

  Gắn ở `main.go` trước các route (sau reqlog/CORS). Khi handler đọc body vượt giới hạn, Go trả `*http.MaxBytesError` → binding fail; handler map lỗi này thành **413 PAYLOAD_TOO_LARGE** theo envelope `httperr`. Điểm map đặt tại helper bind chung của posts handler (nơi gọi `ShouldBindJSON`) — check `errors.As(err, &maxBytesErr)`.

### 5. Core + Admin — M5: optimistic locking end-to-end

**DB (migration Atlas):** `posts` thêm cột `version bigint not null default 1`.

**Core:**

- `domain.go`: `Post` thêm `Version int64`; lỗi mới `ErrVersionConflict`.
- `repository.go`: `gormPost` thêm `Version int64`; `Update` đổi từ `Save` sang update có điều kiện:

  ```sql
  UPDATE posts SET ..., version = version + 1 WHERE id = ? AND version = ?
  ```

  `RowsAffected == 0` → query lại theo id: không có dòng → `ErrPostNotFound`; có dòng → `ErrVersionConflict`.
- `service.go`: `UpdateInput` thêm `Version int64`; `Update` truyền version từ input vào `existing` trước khi gọi repo (KHÔNG lấy version từ bản `GetByID` mới đọc — phải là version client đang cầm, nếu không check vô nghĩa).
- `handler.go`: request DTO update thêm `Version int64` **bắt buộc** (`version < 1` → 400 VALIDATION); response DTO thêm `version`; map `ErrVersionConflict` → **409 VERSION_CONFLICT**. Create không cần version (luôn bắt đầu 1).
- Ghi chú tương thích: admin là client ghi duy nhất và sửa cùng slice — không cần chế độ "bỏ qua check khi thiếu version".

**Admin FE:**

- `packages/types/src/index.ts`: `PostSchema` thêm `version: z.number().int()`; `UpsertPostInput` — update input chứa `version` (create không gửi).
- `apps/admin/src/features/posts/PostFormPage.tsx`: giữ version của bản đã load (theo cơ chế hydrate-once sẵn có từ A1); gửi kèm khi update.
- Xử lý 409: mutation `onError` nhận `ApiError` code `VERSION_CONFLICT` → toast lỗi "Bài đã bị sửa ở nơi khác" + nút/action **"Tải bản mới nhất"** → invalidate + refetch query bài, reset cờ hydrate để form nạp bản mới (thay đổi đang gõ bị thay bằng bản server — người dùng tự áp lại; đây là trade-off chấp nhận được, không làm merge).

### 6. Core — Outbox (bảng + writer trong transaction + dispatcher poll)

**Bảng (migration Atlas)** — model đặt trong package mới `internal/platform/outbox`, đăng ký vào `cmd/atlas-loader`:

```sql
outbox(
  id           uuid pk default gen_random_uuid(),
  aggregate    text not null,          -- "post"
  aggregate_id uuid not null,
  event_type   text not null,          -- post.created | post.updated | post.deleted
  payload      jsonb not null,         -- {id, slug, status, version}
  created_at   timestamptz not null default now(),
  processed_at timestamptz null
)
-- partial index: (created_at) WHERE processed_at IS NULL
```

**Writer:**

- `outbox.Write(tx *gorm.DB, aggregate string, aggregateID uuid.UUID, eventType string, payload any) error` — insert 1 dòng bằng chính `tx` đang mở.
- `posts/repository.go`: `Create`/`Update`/`Delete` hiện đã chạy trong transaction (hoặc bọc thêm nếu chưa) → gọi `outbox.Write` **trong cùng tx**, event `post.created`/`post.updated`/`post.deleted`, payload `{id, slug, status, version}`. Không phân biệt published hay không ở producer — consumer Phase 2 tự lọc theo `status` trong payload.
- Module posts phụ thuộc `platform/outbox` (platform là tầng dưới, không vi phạm hướng phụ thuộc module→platform hiện có).

**Dispatcher:**

- `outbox.Dispatcher` struct: `New(db *gorm.DB, h Handler, log *slog.Logger, interval time.Duration)`; `Handler` là interface `Handle(ctx context.Context, e Event) error`.
- `Run(ctx context.Context)`: vòng lặp ticker (~10s): `SELECT ... WHERE processed_at IS NULL ORDER BY created_at LIMIT 50` → gọi handler từng event → thành công thì set `processed_at = now()`; lỗi thì log và để lại (retry vòng sau). Dừng khi `ctx.Done()`.
- Handler mặc định slice này: `LogHandler` — log `slog.Info("outbox event", ...)`. Phase 2 thay bằng handler thật (đẩy queue/HTTP) hoặc cho AI worker poll thẳng bảng (khi đó tắt dispatcher qua wiring).
- `main.go`: chạy `go dispatcher.Run(ctx)` với `ctx` graceful-shutdown sẵn có (`signal.NotifyContext`) — shutdown là dispatcher dừng theo, không cần drain riêng (event chưa xử lý nằm lại DB, không mất).
- Single-instance deployment nên chưa cần `FOR UPDATE SKIP LOCKED`; ghi chú trong code để Phase 2 thêm nếu scale ngang.

## Dữ liệu & migration

Một migration Atlas mới (diff từ GORM models) gồm: `posts.version bigint not null default 1` (backfill tự nhiên nhờ default) + bảng `outbox` + partial index. Quy trình như README core: sửa model → `atlas migrate diff --env gorm` → `atlas migrate apply`.

## Testing & verify

TDD từng hạng mục. Repo test theo pattern sẵn có của `repository_test.go`: Postgres thật qua `TEST_DATABASE_URL`, mỗi test một transaction rollback (skip khi env không set) — nhớ thêm model outbox (và cột version) vào `AutoMigrate` trong `TestMain`.

- **M1:** repo test — save 2 post cùng một tag mới → chỉ 1 dòng tag, cả hai post link đúng ID; tag đã tồn tại → không tạo trùng, ID trả về đúng. (Race goroutine thật không test được trong pattern tx-rollback; `ON CONFLICT` atomic loại bỏ race về mặt cấu trúc.) Lỗi slug *post* trùng vẫn map `SLUG_TAKEN`.
- **M2:** middleware test — email trong allowlist → pass; email bị gỡ → 401 + session destroy (request sau đó 401 dù không đổi cookie).
- **M3:** handler test — route mới `/stats/posts*` hoạt động sau auth; `GET /posts/stats` giờ khớp `:slug` → 404 khi không có bài, trả bài khi có bài slug `stats`.
- **M4:** middleware/handler test — body vượt limit → 413 envelope httperr; body dưới limit → bình thường.
- **M5:** repo test — update với version cũ → `ErrVersionConflict`, version đúng → tăng version; service test — version truyền từ input; handler test — thiếu version → 400, conflict → 409 `VERSION_CONFLICT`.
- **Outbox:** repo test — create/update/delete post → có dòng outbox đúng event/payload **cùng transaction** (post fail → không có event); dispatcher test — event chưa xử lý → handler được gọi → `processed_at` set; handler lỗi → giữ nguyên để retry.
- **Admin:** test form gửi `version` khi update; 409 → hiện toast conflict + action tải lại.

**Verify E2E (stack thật):** sửa bài ở 2 tab → tab sau nhận 409 + toast + nút tải lại hoạt động; gỡ email khỏi `ADMIN_ALLOWLIST` (restart core) → request admin kế tiếp 401 ngay; POST body >2 MiB → 413; tạo bài slug `stats` → `GET /api/v1/posts/stats` trả bài viết, Dashboard vẫn hiện số liệu (URL mới); bảng `outbox` có event và log dispatcher + `processed_at` được set. Sau verify: security-review, đánh dấu ✅ RESOLVED cho M1–M5 trong issue tracker, cập nhật CLAUDE.md ("Trạng thái hiện tại" + "📍 Điểm hiện tại").

## Trình tự triển khai (gợi ý cho plan)

1. M4 (nhỏ, độc lập) → 2. M2 → 3. M3 (core + admin URL) → 4. M1 → 5. M5 core → 6. M5 admin FE (+types) → 7. Outbox (migration → writer trong tx → dispatcher + wiring) → 8. Verify E2E + security-review + docs.
