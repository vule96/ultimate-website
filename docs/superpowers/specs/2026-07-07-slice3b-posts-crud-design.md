# Slice 3b — Quản lý posts qua UI (admin)

> Spec triển khai · Ngày 2026-07-07 · Dự án `ultimate-website`
> Sub-slice thứ hai của Slice 3 (Phase 1). Tiếp nối 3a (admin shell + auth). Xem spec Slice 1 (posts core), Slice 2 (auth BFF), 3a (admin shell).

## 1. Mục tiêu & phạm vi

Biến `apps/admin` từ khung tĩnh (data giả) thành công cụ quản lý bài viết thật: liệt kê,
tìm kiếm, lọc, phân trang, tạo, sửa, xoá — gọi core API qua TanStack Query, tái sử dụng
Zod schemas + branded types ở `packages/types`. Bổ sung 2 thay đổi nhỏ ở core (search `q`,
endpoint `stats`) để đủ dữ liệu cho danh sách và Dashboard.

**Trong phạm vi 3b:**
- Core (Go, TDD): thêm tham số `q` (search theo tiêu đề, ILIKE) cho list posts; thêm
  `GET /api/v1/posts/stats` trả `{ total, published, draft, tags }`.
- Admin: TanStack Query (`QueryClientProvider`), feature `posts` (api + hooks), trang
  danh sách (bảng + filter status/tag + search debounce + phân trang), form tạo/sửa
  (react-hook-form + zodResolver), xoá có xác nhận, toast tối giản tự viết.
- Content tạm bằng `<textarea>` → `content_html`; `content_json` để `{}` (editor thật ở 3c).
- Dashboard: nối 4 StatCard + "Bài gần đây" với API thật; chart giữ placeholder (ghi chú "dữ liệu mẫu").

**Ngoài phạm vi:**
- Rich editor Tiptap/Lexical + module media/upload → **Slice 3c** (xem §11).
- Chart Dashboard nối aggregate thật → 3c.
- Trang Tags/Media/Settings (vẫn Placeholder).

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Data fetching | TanStack Query (`@tanstack/react-query`) |
| Form | react-hook-form + `@hookform/resolvers` (zodResolver) |
| Search | Thêm `q` (ILIKE theo `title`) vào core list |
| Dashboard | Stat cards + Recent posts nối API thật; chart để placeholder |
| Xoá | Dialog xác nhận (`@radix-ui/react-alert-dialog`) |
| Select filter | `@radix-ui/react-select` |
| Toast | Tự viết tối giản (tránh thêm dep) |
| Content tạm | `<textarea>` → `content_html`; `content_json = {}` |
| Editor thật (Tiptap + Lexical) | Hoãn 3c, dùng interface chung + flag |

## 3. Thay đổi core (Go, TDD)

### 3.1 Search `q`
- `posts.ListFilter` thêm field `Search string`.
- Repository `List`: khi `Search != ""` thêm điều kiện `title ILIKE '%' || ? || '%'`
  vào cả query đếm và query lấy trang (dùng lại `applyFilters`).
- Handler đọc `c.Query("q")`, trim, gán vào filter.
- Test repo: seed vài post, search khớp một phần tiêu đề (không phân biệt hoa thường,
  hỗ trợ tiếng Việt), xác nhận `total` + `data` đúng.

### 3.2 Endpoint stats
- `GET /api/v1/posts/stats` (public GET như các GET khác) → JSON:
  ```json
  { "total": 12, "published": 5, "draft": 6, "tags": 8 }
  ```
  (`total` = tất cả trạng thái; `published` = PUBLISHED; `draft` = DRAFT; `tags` = số tag phân biệt.)
- Repository `Stats(ctx) (StatsResult, error)` dùng `COUNT`; service `Stats`; handler `handleStats`.
- Test repo: seed hỗn hợp trạng thái + tags, xác nhận đếm đúng.

### 3.3 packages/types
- Thêm `PostStatsSchema` = `z.object({ total, published, draft, tags: z.number().int() })`
  và `export type PostStats`.

## 4. Admin — cấu trúc

```
apps/admin/src/
├── lib/queryClient.ts              # tạo QueryClient (staleTime hợp lý, retry gọn)
├── features/posts/
│   ├── api.ts                      # listPosts/getPostBySlug/createPost/updatePost/deletePost/fetchStats
│   ├── queries.ts                  # usePostsQuery/usePostQuery/useStatsQuery + mutations (invalidate)
│   ├── keys.ts                     # query keys tập trung
│   ├── formSchema.ts               # zod schema cho form + type PostFormValues
│   ├── PostsListPage.tsx
│   ├── PostFormPage.tsx            # dùng chung tạo/sửa
│   └── components/
│       ├── PostsTable.tsx
│       ├── PostsToolbar.tsx        # search + filter status/tag + nút thêm
│       ├── StatusBadge.tsx
│       └── DeleteDialog.tsx
├── features/tags/api.ts            # listTags (cho filter + form)
├── components/ui/                  # bổ sung: select, alert-dialog, toast (nếu cần)
```

- `main.tsx`: bọc `<QueryClientProvider client={queryClient}>`.
- **Routes** (`router.tsx`): `/posts` (list), `/posts/new` (tạo), `/posts/:slug/edit` (sửa).
  Sidebar "Bài viết" trỏ `/posts` thật; Tags/Media/Settings vẫn Placeholder.

## 5. Trang danh sách (`PostsListPage`)

- Bảng cột: **Tiêu đề · Trạng thái (badge) · Tags · Cập nhật · Thao tác** (Sửa / Xoá).
- Toolbar: ô search (debounce ~300ms), select Status (Tất cả/DRAFT/PENDING_APPROVAL/PUBLISHED),
  select Tag (từ `/tags`), nút "Thêm bài viết" → `/posts/new`.
- Phân trang: tính từ `total` + `page_size` (mặc định 10); nút Trước/Sau + chỉ số trang.
- Trạng thái: loading (skeleton/spinner), empty ("Chưa có bài viết"), error (banner + nút thử lại).
- State filter/search/page giữ ở URL search params để chia sẻ/back được (dùng `useSearchParams`).

## 6. Form tạo/sửa (`PostFormPage`)

- `formSchema.ts` (Zod): `title` bắt buộc (min 1); `slug` optional; `status` enum mặc định `DRAFT`;
  `tags` là chuỗi CSV (transform → `string[]`, bỏ rỗng, trim); `excerpt`/`meta_title`/`meta_desc`
  optional; `content` (string, → `content_html`).
- react-hook-form + `zodResolver`. Sửa: prefill từ `usePostQuery(slug)`; CSV tags nối từ `post.tags`.
- Fields: Title, Slug (placeholder "để trống sẽ tự sinh"), Status (select), Tags (input CSV),
  Excerpt (textarea), Content (textarea → `content_html`), mục gộp "SEO (tuỳ chọn)" cho meta_title/desc.
- Submit → build `UpsertPostInput` (`content_json = {}`): tạo `POST /posts`, sửa `PUT /posts/{post.id}`.
  Thành công → invalidate `posts`/`stats`, toast, điều hướng `/posts`.
- Lỗi: validation hiển thị dưới field; lỗi API (vd 409 slug trùng) hiển thị banner đầu form.

## 7. Xoá

- `DeleteDialog` (radix alert-dialog): xác nhận, gọi `deletePost(id)` (mutation),
  thành công → invalidate + toast; đang xoá disable nút.

## 8. Dashboard nối thật

- 4 `StatCard` ← `useStatsQuery()` (`/posts/stats`): Tổng bài · Đã xuất bản · Nháp · Tags.
- "Bài gần đây" ← `usePostsQuery({ page: 1, page_size: 5 })` (sắp theo `updated_at` giảm dần — core mặc định).
- Chart giữ mock, thêm nhãn nhỏ "dữ liệu mẫu".
- Loading/error mỗi widget xử lý cục bộ, không chặn cả trang.

## 9. API client & kiểu

- Dùng lại `apiFetch<T>(path, schema, init)` (đã có, credentials: 'include').
- `api.ts` validate response bằng Zod:
  - `listPosts(params)` → `PostListResponseSchema`; build query string từ `page/page_size/status/tag/q` (bỏ field rỗng).
  - `fetchStats()` → `PostStatsSchema`.
  - `getPostBySlug(slug)` → `PostSchema`.
  - create/update gửi JSON, `deletePost` schema `null` (204).
- `id` truyền qua `PostId` branded khi có (từ post đã load); URL path dùng chuỗi id.

## 10. Test & DoD

**Core (Go, TDD):**
- Repo: `TestRepo_List_SearchByTitle` (khớp một phần, không phân biệt hoa thường, tiếng Việt),
  `TestRepo_Stats` (đếm total/published/draft/tags đúng).
- Handler: `stats` trả JSON đúng shape.
- `go test ./...` xanh.

**Admin (Vitest):**
- `posts/api.ts`: build query string đúng (page/page_size/status/tag/q; bỏ rỗng).
- `posts/formSchema.ts`: thiếu title → lỗi; tags CSV → mảng đã trim/bỏ rỗng.
- `PostsTable`: render rows + trạng thái empty.
- `pnpm --filter admin test` + `tsc --noEmit` + `build` xanh.

**E2E (đăng nhập thật):**
1. `/posts` hiển thị bài thật; search/filter/phân trang chạy.
2. Tạo bài mới → thấy trong danh sách.
3. Sửa bài → cập nhật đúng.
4. Xoá (xác nhận) → biến mất.
5. Dashboard cards + "Bài gần đây" hiện số thật.

## 11. Ranh giới & chuẩn bị cho 3c (2 editor)

3c sẽ thay `<textarea>` content bằng **rich editor** với **hai implement dùng chung một interface**:

```ts
interface PostEditorProps {
  valueJson: unknown;                                   // content_json (nguồn chuẩn)
  onChange: (v: { json: unknown; html: string }) => void;
}
```

- `TiptapEditor` và `LexicalEditor` cùng implement `PostEditorProps`; chọn qua flag
  (`VITE_EDITOR=tiptap|lexical`, mặc định `tiptap`). `PostFormPage` chỉ import một
  `EditorSwitch`, không phụ thuộc thư viện cụ thể → dễ so sánh & thay thế.
- Cả hai xuất `content_html` (SSR/SEO ở `apps/web`) + `content_json` (chỉnh sửa lại).
- Kèm module `media` (presigned R2/MinIO) để chèn ảnh trong cả hai editor.
- Chart Dashboard nối aggregate thật.

Vì 3b đã tách sẵn `content_html`/`content_json` trong form + Zod, việc thay bằng
`EditorSwitch` ở 3c là drop-in, không đụng logic submit/validate.
