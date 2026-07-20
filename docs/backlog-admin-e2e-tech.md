# Backlog triển khai — Nợ admin (3) + E2E reader (4) + Kỹ thuật (5)

**Ngày lập:** 2026-07-20. Mục để session sau mở ra làm. Mỗi mục có: cần gì, file/endpoint, cách làm, verify.
Quy trình từng mục: brainstorm (nếu lớn) → spec → TDD → verify → commit. Đổi BE nhớ rebuild **cả core lẫn admin** image.

---

## (3) Nợ nhỏ admin

### 3.1 Unsubscribe flow — subscriber tự huỷ qua link email
- **BE** (`internal/modules/readers`): migration thêm `subscribers.unsubscribe_token uuid DEFAULT gen_random_uuid()` + `status` đã có (`active`). Endpoint **public** `GET /unsubscribe?token=...` → set `status='unsubscribed'` (không xoá — audit) → trả trang/redirect xác nhận. Repo `UnsubscribeByToken(token)`.
- **Web** (`apps/web`): trang `/unsubscribe` (Next, public) hiện kết quả; footer/email bản tin chèn link `WEB_BASE_URL/unsubscribe?token=`.
- **Admin**: cột Status (active/unsubscribed) + filter ở `/subscribers`.
- **Verify**: repo test (token đúng→unsub, sai→404); admin list hiện status.

### 3.2 Reader profile / GDPR delete
- **BE**: `DELETE /auth/reader/me` sau `RequireReader` → xoá reader (bookmarks tự cascade — FK `ON DELETE CASCADE` đã có trong migration `add_readers`) → destroy reader session. Service `DeleteReader(id)`.
- **Web**: menu reader thêm "Xoá tài khoản" → confirm dialog → gọi API → logout + toast.
- **Verify**: test xoá reader → bookmarks biến mất; E2E: login reader → xoá → không đăng nhập lại được với data cũ.

### 3.3 ⌘K palette — search bài viết thật
- **Admin** (`apps/admin/src/app/CommandPalette.tsx`): thêm section động "Bài viết" — debounce input → `useQuery(listPosts({q, pageSize:5}))` → item navigate `/posts/$slug/edit`. Giữ nav tĩnh hiện có. (Optional: action nhanh "Đổi trạng thái" gọi `useUpdatePost`.)
- **Verify**: gõ tên bài → hiện kết quả → Enter mở edit.

### 3.4 Paging count tối ưu (subscribers/readers lớn)
- **BE** (`readers/repository.go`): hiện `COUNT(*)` toàn bảng mỗi request. Chọn 1: (a) cache count qua Redis key `subscribers:count`/`readers:count` TTL 30-60s (bump khi insert/delete); (b) estimate `pg_class.reltuples` cho số lớn; (c) cursor pagination (bỏ total). Đề xuất (a) — đơn giản, đủ tốt.
- **Verify**: count đúng sau insert/delete trong TTL; load test không N+1.

### 3.5 Soft-delete subscriber (audit)
- **BE**: thêm `subscribers.deleted_at timestamptz NULL`. `DeleteSubscriber` → set `deleted_at=now()` thay hard delete. `ListSubscribers` filter `deleted_at IS NULL`. (Cân nhắc gộp với 3.1 status.)
- **Verify**: xoá → không hiện list nhưng row còn; test repo.

### 3.6 Topbar context theo trang
- **Admin** (`app/Topbar.tsx`): bỏ nút Bell placeholder; action đổi theo route — vd `/subscribers` → nút "Xuất CSV" lên topbar (thay để trong page). Dùng route match hoặc slot/portal.
- **Verify**: mỗi trang topbar đúng action.

### 3.7 Dark mode admin (nếu muốn — hiện light-only)
- **Admin** (`styles/index.css`): thêm block `.dark` với cerulean dark variant (nền charcoal, primary sáng hơn) + toggle (dùng use-theme pattern như web). KPI/status token dark.
- **Verify**: toggle sáng/tối, contrast WCAG.

### 3.8 Bundle admin >1MB — code-split
- **Admin**: editor tiptap/lexical đã lazy-chunk. Xét: lazy dashboard chart (`PostsChart`), `manualChunks` tách vendor (react/router/query). Đo bằng `rollup-plugin-visualizer`.
- **Verify**: chunk chính < ~500KB gzip; lazy đúng.

---

## (4) E2E live — Slice 13 reader flow (KHÔNG phải code, thao tác tay)

**Chuẩn bị:**
- Google Console: thêm reader redirect URI `http://localhost:8080/auth/reader/google/callback` (dev) + URL prod.
- Stack có **Redis** (prod stack đã có): `.env` gồm `REDIS_URL`, `VIEW_DEDUP_SALT`, `CORS_ALLOWED_ORIGINS` (+`:3000`), `READER_REDIRECT_URL`, `WEB_BASE_URL`.

**Kịch bản test (trên `:3000` web):**
1. Nút "Tiếp tục với Google" → login reader Google thật → về web đã đăng nhập.
2. Bookmark 1 bài → **reload** → bookmark còn (persist DB, không phải localStorage).
3. Newsletter subscribe → 201; spam >5 lần/phút → **429** (rate limit).
4. Xem 1 bài 2 lần cùng session → views chỉ **+1** (view dedupe Redis 48h).
5. (nối 3.2) nếu đã làm GDPR delete: xoá tài khoản reader → data sạch.

---

## (5) Nợ kỹ thuật

### 5.1 Senior review L1–L6
- Đọc `docs/reviews/2026-07-11-senior-code-review.md` mục **L1–L6** (low, chưa được yêu cầu). Resolve nếu ưu tiên; đánh dấu `✅ RESOLVED (ngày, commit)` tại chỗ.

### 5.2 FK cascade chưa có test
- **Lưu ý**: `AutoMigrate` (dùng trong test hiện tại) **KHÔNG tạo FK** — chỉ migration Atlas có. Test cascade phải chạy trên DB đã `atlas migrate apply` (không phải AutoMigrate). Cần TestMain riêng apply migration, hoặc test integration tách.
- **Test**: tạo reader + bookmark → `DELETE FROM readers` → bookmark tự xoá (cascade). Tương tự subscribers/bookmarks FK post.

### 5.3 Backup upload R2 THẬT chưa test
- Hiện `scripts/backup-db.sh` mới verify qua **MinIO** + restore drill. `.env.prod` `STORAGE_ENDPOINT` còn placeholder `<account>` (R2 chưa cấu hình).
- **Làm**: điền `STORAGE_*` R2 thật + `BACKUP_BUCKET` → chạy `./scripts/backup-db.sh` → verify file `.sql.gz` trên R2 + prune giữ `BACKUP_KEEP`. Rồi test `./scripts/restore-db.sh` (R2 mode, không `--file`).

---

## Ghi chú chung
- Nhiều mục admin (3.1, 3.2, 3.5) đụng schema `subscribers`/`readers` → cân nhắc **gộp 1 migration** (unsubscribe_token + deleted_at) + 1 đợt BE thay vì rải.
- Sau đổi BE: rebuild `core` **và** `admin` image (đã dính lỗi core stale 2026-07-20).
- Types `packages/types` là bản chép tay struct Go → đổi field phải cập nhật cùng commit.
