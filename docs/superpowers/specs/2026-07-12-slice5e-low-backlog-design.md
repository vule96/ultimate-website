# Slice 5e — Dọn backlog Low (L8, L9, L10, L11, L12)

**Ngày:** 2026-07-12
**Trạng thái:** Design đã được duyệt
**Nguồn finding:** `docs/reviews/2026-07-11-senior-code-review.md` (mục 🟢 Low, core Go)

## Mục tiêu

Resolve toàn bộ finding Low còn mở trong senior code review: L8, L9, L10, L11 (phần còn lại), L12. Sau slice này backlog review sạch hoàn toàn (trừ L1–L6 chưa được yêu cầu), sẵn sàng chốt bước lớn tiếp theo (Deploy production hoặc Phase 2).

## Phạm vi

- Chỉ core Go (`services/core`) + `docker-compose.yml` + README. Không đụng FE (admin/web).
- 5 fix nhỏ độc lập, làm theo TDD trên 1 nhánh `slice-5e-low-backlog`.

**Ngoài phạm vi:** L1–L6 (các Low khác), mọi thay đổi FE, deploy, Phase 2.

## Thiết kế từng fix

### L8 — Media storage: unexported return type + expires hardcode

Hiện trạng: `NewS3Storage` (`internal/modules/media/storage_s3.go:36`) trả `*s3Storage` (unexported type — linter/godoc unfriendly); `expires: 15 * time.Minute` hardcode (`:48`).

Fix:
- `NewS3Storage(cfg S3Config) media.Storage` — trả interface port đã có sẵn (`domain.go:49`).
- Thêm field `PresignExpires time.Duration` vào `S3Config`; zero value → default `15 * time.Minute` (giữ hành vi cũ).
- Wire từ env `STORAGE_PRESIGN_EXPIRES` (optional, ví dụ `15m`, parse bằng `time.ParseDuration`; rỗng → default). Giá trị không parse được hoặc ≤ 0 → `config.Load` trả error (nhất quán L11).
- Cập nhật `.env.example` + README core (mục Object storage).

### L9 — `bindJSON` leak internals Go ra client

Hiện trạng: `posts/handler.go:267` — `httperr.Write(c, 400, "INVALID_BODY", err.Error())` lộ tên struct/kiểu Go của Gin binding.

Fix:
- Message trả client cố định: `"invalid request body"`.
- Chi tiết lỗi ghi log qua contextual slog của request (level debug/info), không ra response.
- Rà handler `media` (và module khác nếu có `ShouldBindJSON`) — áp dụng cùng pattern.

### L10 — Orphan tags không bao giờ được dọn

Hiện trạng: tag hết được bài nào dùng vẫn nằm trong bảng `tags` → phình `/tags` (authed) và `Stats.Tags`.

Fix (đã chốt: xóa trong cùng transaction):
- Sau `Update` (replace tags) và `Delete` post, trong **cùng tx** chạy dọn orphan:
  `DELETE FROM tags t WHERE NOT EXISTS (SELECT 1 FROM post_tags pt WHERE pt.tag_id = t.id)`.
- Không mất gì khi xóa nhầm về sau: tag dùng lại sẽ được upsert theo slug (M1 đã làm atomic).
- Helper riêng trong repository (vd `deleteOrphanTags(tx)`) để cả Update lẫn Delete gọi.

Test:
- Update bỏ tag cuối cùng của một bài → tag biến mất khỏi list tags.
- Delete post → tag chỉ bài đó dùng bị dọn.
- Tag còn bài khác dùng → giữ nguyên.

### L11 (phần còn lại) — `getBoolEnv`/`getInt64Env` nuốt lỗi parse

Hiện trạng: `platform/config/config.go:91-113` — giá trị không hợp lệ (`SESSION_COOKIE_SECURE=ture`, `MAX_BODY_BYTES=abc`) rơi im lặng về fallback. (Phần assertion `samesite=none ⇒ secure` đã resolved ở Slice 5a.)

Fix:
- `getBoolEnv`, `getInt64Env` trả thêm `error`; giá trị set nhưng không parse được (hoặc int ≤ 0) → `Load` trả error fail-fast với message nêu rõ tên env.
- Env không set → vẫn dùng fallback như cũ, không error.
- Test bảng: giá trị hợp lệ / rỗng / rác cho cả bool và int64.

### L12 — Test integration cách li khỏi dev DB (cả hai hướng)

Hiện trạng: test integration dùng `TEST_DATABASE_URL`, các phiên verify/E2E hay trỏ vào dev DB `blog` → test đếm toàn bảng (Stats/List total) fail chập chờn dù tx-rollback; 2 test dispatcher outbox (`TestDispatcher_ProcessesAndMarks`, `TestDispatcher_HandlerErrorKeepsEvent`) quét pending không filter — dính row committed từ session khác.

Fix (đã chốt: làm cả hai):
1. **Infra:** thêm init script `docker-entrypoint-initdb.d` (mount trong `docker-compose.yml`) tạo sẵn database `blog_test` khi volume Postgres mới; volume cũ giữ lệnh `createdb` một-lần trong README (đã có sẵn ở README core). Test đã tự `AutoMigrate` schema nên không cần Atlas cho DB test.
2. **Test robust (phòng khi vẫn trỏ DB bẩn):**
   - Test đếm toàn bảng (Stats/List total) chuyển sang đo **delta** (đếm trước/sau trong cùng tx) hoặc filter theo data tự tạo.
   - 2 test dispatcher outbox scope query theo event id tự tạo (dispatcher production giữ nguyên hành vi quét toàn bộ pending — chỉ test đổi cách assert, có thể qua option/filter test-only).

## Testing & verify

- TDD từng fix (test trước, fix sau).
- Toàn bộ test core xanh với `TEST_DATABASE_URL` trỏ `blog_test`.
- Verify E2E nhanh bằng curl cho L9 (body rác → message generic) và L10 (update/delete → orphan tag biến mất khỏi `/tags`).
- `docker compose down -v && up -d` một lần để verify init script tạo `blog_test`.

## Sau khi xong

- Đánh dấu `✅ RESOLVED (2026-07-12, commit <hash>)` tại L8, L9, L10, L11, L12 trong `docs/reviews/2026-07-11-senior-code-review.md`.
- Cập nhật "Trạng thái hiện tại" + "📍 Điểm hiện tại" trong `CLAUDE.md`.
