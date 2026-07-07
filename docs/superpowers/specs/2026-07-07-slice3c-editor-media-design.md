# Slice 3c — Rich editor (Tiptap + Lexical) + media + chart

> Spec triển khai · Ngày 2026-07-07 · Dự án `ultimate-website`
> Sub-slice cuối của Slice 3 (Phase 1). Tiếp nối 3b (posts CRUD, content tạm bằng textarea).

## 1. Mục tiêu & phạm vi

Thay `<textarea>` nội dung bằng **rich editor** với **hai implement** (Tiptap + Lexical) dùng
chung một interface, chọn qua flag `VITE_EDITOR`. Thêm module **media** cho phép **upload ảnh
trực tiếp** lên object storage (MinIO dev / R2 prod) qua **presigned PUT**. Nối **chart Dashboard**
với dữ liệu tổng hợp thật.

Ba phần gần như độc lập, làm theo thứ tự **A → B → C**:
- **A. media**: backend presign + docker MinIO + FE upload helper.
- **B. editors**: interface chung + Tiptap + Lexical (baseline parity → extras).
- **C. chart**: endpoint timeseries + nối `PostsChart`.

**Ngoài phạm vi:**
- Trang thư viện Media (grid duyệt ảnh) — slice sau nếu cần.
- Dọn rác ảnh (xoá object khi gỡ khỏi bài).
- Ép parity tuyệt đối các extras giữa 2 editor nếu quá tốn — ưu tiên baseline parity.

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Storage dev | MinIO (docker), `aws-sdk-go-v2` (S3 API), cấu hình qua env → R2-ready |
| Luồng upload | Presigned PUT (client upload thẳng, không qua core) |
| Interop nội dung | HTML là cầu nối: nạp từ `content_html`; lưu `content_json` native best-effort |
| Bộ tính năng | Baseline parity + extras (bảng, task list, highlight) |
| Chart | Làm trong 3c (endpoint timeseries) |
| Chọn editor | Flag `VITE_EDITOR=tiptap\|lexical`, mặc định `tiptap` |

## 3. Backend — module `media` (Go, Clean-lite, TDD)

### 3.1 Config (env, S3-compatible)
`STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`,
`STORAGE_BUCKET`, `STORAGE_PUBLIC_URL`, `STORAGE_USE_PATH_STYLE` (`true` cho MinIO).

### 3.2 Kiến trúc
- Port `Storage`: `PresignPut(ctx, key, contentType string) (url string, expires time.Duration, err error)`.
- Impl `s3storage` dùng `aws-sdk-go-v2` (`s3.NewPresignClient`), hỗ trợ path-style cho MinIO.
- `Service`:
  - validate `content_type` ∈ {image/png, image/jpeg, image/webp, image/gif};
  - validate `size` ≤ 5 MB (> 0);
  - sinh `key = uploads/<yyyy>/<mm>/<uuid>.<ext>` (ext suy từ content_type);
  - trả `{ upload_url, public_url = STORAGE_PUBLIC_URL + "/" + key, key, expires_in }`.
- `Handler`: `POST /api/v1/media/presign` (bọc `RequireAuth`), body `{ filename, content_type, size }`.

### 3.3 Test
- Service: content_type ngoài allowlist → `ErrValidation`; size 0 / quá lớn → `ErrValidation`;
  key sinh đúng đuôi theo content_type.
- Presign (fake/real MinIO tuỳ có DB test): URL chứa bucket + key. Ưu tiên unit test service với
  Storage giả (mock) để không phụ thuộc MinIO trong `go test`.

## 4. docker-compose + env

- Thêm service **minio** (ports 9000 API / 9001 console) + service init (`minio/mc`) tạo bucket
  `blog-media` và set policy **public-read** cho prefix `uploads/`.
- `.env.example`: thêm khối `STORAGE_*` với giá trị MinIO dev
  (`STORAGE_ENDPOINT=http://localhost:9000`, `STORAGE_PUBLIC_URL=http://localhost:9000/blog-media`,
  `STORAGE_USE_PATH_STYLE=true`, access/secret = `minioadmin`). `.env` thật do người dùng điền.

## 5. Frontend — media

`features/media/api.ts`:
- `uploadImage(file: File): Promise<string>`:
  1. validate loại/size phía client (cùng allowlist);
  2. `POST /media/presign` → `{ upload_url, public_url }` (Zod-validated);
  3. `fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } })`;
  4. trả `public_url`.
- `packages/types`: `PresignResponseSchema`.

## 6. Frontend — editors

```
apps/admin/src/features/editor/
├── types.ts             # PostEditorProps
├── config.ts            # đọc VITE_EDITOR (mặc định "tiptap")
├── EditorSwitch.tsx     # React.lazy 2 editor + Suspense fallback
├── ToolbarButton.tsx    # nút toolbar dùng chung (icon + active state + style)
├── tiptap/TiptapEditor.tsx
└── lexical/LexicalEditor.tsx
```

### 6.1 Interface chung
```ts
interface PostEditorProps {
  initialHtml: string;
  onChange: (v: { html: string; json: unknown }) => void;
  uploadImage: (file: File) => Promise<string>;
}
```

### 6.2 Nạp/lưu (HTML là cầu nối)
- Khởi tạo mỗi editor từ `initialHtml` (Tiptap: `content` HTML; Lexical: `@lexical/html`
  `$generateNodesFromDOM`). → mở được bài dù tạo bằng editor nào.
- `onChange` phát `html` (Tiptap `getHTML()` / Lexical `$generateHtmlFromNodes`) + `json`
  native (Tiptap `getJSON()` / Lexical `editorState.toJSON()`), best-effort.

### 6.3 Chèn ảnh
- Toolbar nút ảnh → `<input type=file>` → `uploadImage(file)` → chèn image node với `public_url`.

### 6.4 Bộ tính năng
- **Baseline parity (giống nhau ở cả 2):** bold, italic, H2/H3, bullet list, ordered list, link,
  image, blockquote, code block, horizontal rule.
- **Extras (thêm sau baseline; parity best-effort):** bảng, task list, highlight.

### 6.5 Code-split
- `EditorSwitch` dùng `React.lazy(() => import("./tiptap/TiptapEditor"))` / lexical, bọc `Suspense`
  (fallback: khung editor + spinner). Giảm bundle chính (đang cảnh báo >500 KB).

### 6.6 Tích hợp form
- `PostFormPage`: thay `<Textarea content>` bằng `<EditorSwitch initialHtml=… onChange=… uploadImage=…/>`.
- Giữ `content` (html) trong react-hook-form (cập nhật qua `setValue` khi editor đổi) +
  `contentJson` ở `useState`. `toUpsertInput` nhận thêm `json` (mặc định `{}`).

## 7. Chart aggregate (C)

- Core: `GET /api/v1/posts/stats/timeseries?months=8` → `[{ month: "2026-01", count: 3 }, …]`.
  Repo: `GROUP BY date_trunc('month', created_at)`, zero-fill N tháng gần nhất trong Go
  (mặc định 8, chặn 1..24). Handler public GET. Route tĩnh sâu, không đụng `/posts/:slug`.
- `packages/types`: `PostTimeseriesSchema = z.array(z.object({ month: z.string(), count: z.number().int() }))`.
- `PostsChart`: `useQuery` gọi timeseries, bỏ `mockData` + nhãn "dữ liệu mẫu".

## 8. Test & DoD

**Core (Go, TDD):**
- media service: validation + key-gen; presign qua Storage giả.
- posts repo: `TimeSeries` đếm theo tháng + zero-fill đúng.
- `go test ./...` xanh.

**Admin (Vitest):**
- `media/api.ts`: mock fetch → presign rồi PUT, trả `public_url`; validate loại/size.
- `editor/config.ts` / `EditorSwitch`: chọn đúng editor theo flag.
- smoke render mỗi editor + toolbar (jsdom hạn chế contenteditable → chỉ kiểm mount + nút).
- `tsc --noEmit` + `vite build` + `vitest` xanh.

**E2E (đăng nhập thật):**
1. Tạo/sửa bài bằng Tiptap → chèn ảnh (hiện ảnh từ MinIO) → lưu.
2. Mở lại bài (nạp từ HTML) → sửa tiếp OK.
3. Đổi `VITE_EDITOR=lexical` → mở đúng bài đó vẫn sửa được (nạp từ HTML).
4. Dashboard chart hiện số thật.

## 9. Thứ tự triển khai
A (media BE+FE) → B baseline (Tiptap trước, Lexical sau, cùng interface) → B extras → C chart.
Mỗi bước verify độc lập; nếu B extras quá tốn, land baseline parity trước rồi bổ sung.

## 10. Ranh giới slice sau
- Trang thư viện Media (grid + xoá).
- Dọn rác ảnh mồ côi.
- Slice 4: `apps/web` (Next.js) public render `content_html`.
