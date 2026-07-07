# Slice 3e — TanStack Table + DataTable dùng chung

> Spec triển khai · Ngày 2026-07-08 · Dự án `ultimate-website`
> Build trên nhánh `slice-3d-tanstack-router` (3c + 3d chưa merge).

## 1. Mục tiêu & phạm vi

Đưa `@tanstack/react-table` (headless) vào `apps/admin` qua một component **`DataTable<TData>`
generic, typed**; migrate `PostsTable` sang dùng nó; thêm **sorting server-side** (cột bấm được)
và **column visibility toggle** (ẩn/hiện cột). Pagination/filter/search vẫn do server + URL
(TanStack Router) — TanStack Table chạy **manual mode** để không trùng lặp logic.

**Trong phạm vi:** component `DataTable` dùng chung; migrate `PostsTable`; sort server-side cho
posts; column visibility; cập nhật doc/html/artifact.

**Ngoài phạm vi:** trang Tags/Media table thật (slice sau); row selection, client pagination,
lưu column visibility vào localStorage.

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Table lib | `@tanstack/react-table` (headless) |
| Chế độ | Manual: `manualPagination`/`manualFiltering`/`manualSorting = true` (server là nguồn sự thật) |
| Sorting | Server-side (core `sort`/`order`), state qua URL search (TanStack Router) |
| Column visibility | Client-side, state local trong `DataTable`, toggle qua dropdown menu |
| Component | `DataTable<TData>` generic tái sử dụng |
| Nhánh | `slice-3d-tanstack-router` (làm tiếp, không tạo nhánh mới) |

## 3. Backend (Go, TDD)

- `posts.ListFilter` thêm `Sort string` + `Order string`.
- Repository `List`: `ORDER BY` động với **whitelist** cột → chống SQL injection:
  - cho phép: `title`, `status`, `updated_at`, `created_at`; mặc định `created_at`.
  - `order ∈ {asc, desc}`, mặc định `desc`.
  - map field → cột thật: `"posts.<field>"`.
- Handler đọc `c.Query("sort")`, `c.Query("order")`, gán vào filter.
- Test repo: `Sort:"title", Order:"asc"` trả đúng thứ tự tăng dần theo title; `Sort` ngoài
  whitelist → fallback `created_at desc`.
- Không cần migration.

## 4. `packages/types`

```ts
export const PostSortFieldSchema = z.enum(["title", "status", "updated_at", "created_at"]);
export type PostSortField = z.infer<typeof PostSortFieldSchema>;
export const SortOrderSchema = z.enum(["asc", "desc"]);
export type SortOrder = z.infer<typeof SortOrderSchema>;
```

## 5. Component `DataTable` (generic, typed)

`apps/admin/src/components/ui/data-table.tsx`:

```ts
interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  meta?: TableMeta<TData>;
  emptyMessage?: string;
}
```

- `useReactTable({ data, columns, getCoreRowModel, manualSorting: true, state: { sorting,
  columnVisibility }, onSortingChange, onColumnVisibilityChange, meta })`.
- `columnVisibility` là **state local** (`useState<VisibilityState>({})`).
- Render:
  - **Toolbar phải**: `ColumnVisibilityToggle` — dropdown menu liệt kê cột có `enableHiding`,
    mỗi cột một checkbox item bật/tắt `column.toggleVisibility()`.
  - `<table>` giữ style hiện tại (border, hover, `overflow-x-auto`); header dùng `flexRender`;
    cột `enableSorting` render nút bấm + icon sort (▲/▼/·) theo `column.getIsSorted()`.
  - Empty: khi `data.length === 0` hiện `emptyMessage`.
- Dropdown dùng `@radix-ui/react-dropdown-menu` (thêm dep) → component `components/ui/dropdown-menu.tsx`
  (shadcn-style: Root/Trigger/Content/CheckboxItem).

## 6. TypeScript nâng cao

- `createColumnHelper<Post>()` cho cột typed.
- **Module augmentation** để truyền handler typed qua table meta:
  ```ts
  declare module "@tanstack/react-table" {
    interface TableMeta<TData> {
      onDelete: (row: TData) => void;
    }
  }
  ```
  (Actions column đọc `table.options.meta?.onDelete` — không dùng closure lỏng.)
- `SortingState` ↔ URL map qua union typed `PostSortField` (từ Zod).
- `DataTable` full generic `<TData>`.

## 7. Tích hợp PostsTable + PostsListPage

- `PostsTable.tsx`: dựng `columns` bằng `createColumnHelper<Post>()`:
  - **title** (sortable) → `<Link to="/posts/$slug/edit" params>`; hiện `/slug` phụ.
  - **status** (sortable) → `<StatusBadge>`.
  - **tags** (không sort) → chip list.
  - **updated_at** (sortable) → ngày `vi-VN`.
  - **actions** (không sort, không hide) → nút Sửa (Link) + Xoá (`meta.onDelete(row.original)`).
  - render `<DataTable columns data sorting onSortingChange meta={{ onDelete }} emptyMessage="Chưa có bài viết nào." />`.
- `PostsListPage`:
  - `validateSearch` mở rộng: `sort: PostSortFieldSchema.default("created_at").catch("created_at")`,
    `order: SortOrderSchema.default("desc").catch("desc")`.
  - suy `sorting: SortingState = [{ id: search.sort, desc: search.order === "desc" }]`.
  - `onSortingChange`: nhận updater → tính next → `navigate({ search: (p) => ({ ...p,
    sort: next.id, order: next.desc ? "desc" : "asc", page: 1 }) })`; nếu rỗng → về mặc định.
  - loader `postsListQueryOptions` nhận thêm `sort`/`order` (thêm vào `ListPostsParams` +
    `buildPostsQuery`).
- `api.ts`: `ListPostsParams` thêm `sort?`, `order?`; `buildPostsQuery` set `sort`/`order` khi khác mặc định.

## 8. Test & DoD

- **Core (TDD):** `TestRepo_List_SortByTitle` (asc đúng thứ tự), `TestRepo_List_Sort_FallbackOnInvalid`.
  `go test ./...` xanh.
- **Admin (Vitest):**
  - `data-table.test.tsx`: render cột/hàng; empty state; bấm header sortable gọi `onSortingChange`;
    toggle ẩn cột → cột biến mất.
  - `PostsTable.test.tsx`: cập nhật — render title/tag qua DataTable; dùng router harness sẵn có.
  - `posts/api.test.ts`: `buildPostsQuery` thêm `sort`/`order` (bỏ khi mặc định).
  - `tsc` + `vitest` + `vite build` xanh.
- **E2E (đăng nhập):** bấm header Title/Status/Cập nhật → URL đổi `sort`/`order`, dữ liệu server
  sắp đúng toàn bộ; ẩn/hiện cột hoạt động; pagination/filter/search vẫn chạy.

## 9. Docs / HTML / Artifact

- `CLAUDE.md`: admin dùng **TanStack Table** (DataTable dùng chung, manual server-side, column visibility).
- `analysis .md` + `.html`: thêm TanStack Table vào stack (§7 + §14).
- Cập nhật **Artifact** đúng URL cũ (`3c7c4f92-...`).

## 10. Deps
- `@tanstack/react-table`, `@radix-ui/react-dropdown-menu`.
