# Slice 3e — TanStack Table + DataTable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `@tanstack/react-table` via a generic typed `DataTable<TData>` component, migrate `PostsTable` to it, add server-side sorting (clickable headers) and a column-visibility toggle.

**Architecture:** TanStack Table runs in **manual mode** (`manualSorting`/`manualPagination`/`manualFiltering`) — the Go core stays the source of truth for pagination/filter/sort; sort state lives in the URL via TanStack Router `validateSearch`. Column visibility is client-only local state in `DataTable`.

**Tech Stack:** React 18, TypeScript (strict), TanStack Table, TanStack Router, TanStack Query, Zod, Tailwind, Go (Gin + GORM).

## Global Constraints

- pnpm workspaces; run admin cmds from `apps/admin` or `pnpm --filter @ultimate/admin`.
- TS strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — optional props typed `T | undefined` where an explicit `undefined` may be passed.
- Path alias `@/*` → `apps/admin/src/*`. Zod v4; `@ultimate/types` is the shared schema source.
- Branch: `slice-3d-tanstack-router` (continue here; do NOT create a new branch).
- Core sort MUST use a column **whitelist** (no raw user string into ORDER BY).
- Admin build script is `tsc --noEmit && vite build`; `routeTree.gen.ts` is committed.
- Core test DB: `TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"` (needs `docker compose up -d`).

---

### Task 1: Dependencies

**Files:** Modify `apps/admin/package.json`

- [ ] **Step 1: Install**

```bash
cd apps/admin
pnpm add @tanstack/react-table @radix-ui/react-dropdown-menu
```

- [ ] **Step 2: Verify install**

Run: `pnpm ls @tanstack/react-table @radix-ui/react-dropdown-menu | cat`
Expected: both listed with versions.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/package.json ../../pnpm-lock.yaml
git commit -m "chore(admin): add @tanstack/react-table + radix dropdown-menu"
```

---

### Task 2: Core — server-side sort (TDD)

**Files:**
- Modify: `services/core/internal/modules/posts/service.go` (ListFilter)
- Modify: `services/core/internal/modules/posts/repository.go` (List order clause)
- Modify: `services/core/internal/modules/posts/handler.go` (read sort/order)
- Test: `services/core/internal/modules/posts/repository_test.go`

**Interfaces:**
- Produces: `ListFilter.Sort string`, `ListFilter.Order string`; ORDER BY whitelist over `title|status|updated_at|created_at`, default `created_at desc`.

- [ ] **Step 1: Write failing repo tests**

Add to `services/core/internal/modules/posts/repository_test.go`:

```go
func TestRepo_List_SortByTitleAsc(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	_ = repo.Create(ctx, samplePost("Banana", "s-b", StatusPublished))
	_ = repo.Create(ctx, samplePost("Apple", "s-a", StatusPublished))
	_ = repo.Create(ctx, samplePost("Cherry", "s-c", StatusPublished))

	got, _, err := repo.List(ctx, ListFilter{Sort: "title", Order: "asc", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	titles := []string{got[0].Title, got[1].Title, got[2].Title}
	if titles[0] != "Apple" || titles[1] != "Banana" || titles[2] != "Cherry" {
		t.Errorf("title asc order = %v, want [Apple Banana Cherry]", titles)
	}
}

func TestRepo_List_SortFallbackOnInvalid(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	_ = repo.Create(ctx, samplePost("Old", "f-old", StatusPublished))
	_ = repo.Create(ctx, samplePost("New", "f-new", StatusPublished))

	// Field ngoài whitelist → fallback created_at desc (bài tạo sau đứng trước).
	got, _, err := repo.List(ctx, ListFilter{Sort: "id; DROP TABLE posts", Order: "sideways", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if got[0].Title != "New" {
		t.Errorf("fallback order first = %q, want New", got[0].Title)
	}
}
```

- [ ] **Step 2: Run tests — expect FAIL (fields don't exist)**

Run: `cd services/core && TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable" go test ./internal/modules/posts/... 2>&1 | tail -5`
Expected: compile error `unknown field Sort in struct literal`.

- [ ] **Step 3: Add Sort/Order to ListFilter**

In `services/core/internal/modules/posts/service.go`, extend `ListFilter`:

```go
// ListFilter là điều kiện lọc + phân trang cho danh sách bài viết.
type ListFilter struct {
	Status string // lọc theo trạng thái (rỗng = tất cả)
	Tag    string // lọc theo slug tag (rỗng = tất cả)
	Search string // tìm theo tiêu đề (ILIKE, rỗng = tất cả)
	Sort   string // cột sắp xếp (whitelist; rỗng/lạ = created_at)
	Order  string // asc | desc (mặc định desc)
	Limit  int
	Offset int
}
```

- [ ] **Step 4: Apply dynamic ORDER BY (whitelist) in repository.List**

In `services/core/internal/modules/posts/repository.go`, add a helper near the top of the file (after imports) and use it in `List`. First add `"strings"` to the import block. Then add:

```go
// sortColumns whitelist cột được phép ORDER BY (chống SQL injection).
var sortColumns = map[string]string{
	"title":      "posts.title",
	"status":     "posts.status",
	"updated_at": "posts.updated_at",
	"created_at": "posts.created_at",
}

// orderClause dựng mệnh đề ORDER BY an toàn từ field/order do client gửi.
func orderClause(sort, order string) string {
	col, ok := sortColumns[sort]
	if !ok {
		col = "posts.created_at"
	}
	if strings.ToLower(order) == "asc" {
		return col + " ASC"
	}
	return col + " DESC"
}
```

In `List`, replace the hardcoded order line:

```go
		Order("posts.created_at DESC").
```

with:

```go
		Order(orderClause(f.Sort, f.Order)).
```

- [ ] **Step 5: Handler reads sort/order**

In `services/core/internal/modules/posts/handler.go`, in the `list` handler, extend the `ListFilter{...}`:

```go
	posts, total, err := h.svc.List(c.Request.Context(), ListFilter{
		Status: c.Query("status"),
		Tag:    c.Query("tag"),
		Search: strings.TrimSpace(c.Query("q")),
		Sort:   c.Query("sort"),
		Order:  c.Query("order"),
		Limit:  p.PageSize,
		Offset: p.Offset(),
	})
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `cd services/core && TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable" go test -count=1 ./internal/modules/posts/... 2>&1 | tail -5`
Expected: `ok ... posts`.

- [ ] **Step 7: Commit**

```bash
git add services/core/internal/modules/posts/
git commit -m "feat(core): server-side sort for posts list (whitelist order by)"
```

---

### Task 3: Shared types + admin API params

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `apps/admin/src/features/posts/api.ts`
- Test: `apps/admin/src/features/posts/api.test.ts`

**Interfaces:**
- Produces: `PostSortFieldSchema`/`PostSortField`, `SortOrderSchema`/`SortOrder`; `ListPostsParams` gains `sort?: PostSortField`, `order?: SortOrder`; `buildPostsQuery` emits `sort`/`order` when non-default.

- [ ] **Step 1: Add sort types to packages/types**

Append to `packages/types/src/index.ts`:

```ts
/** Cột được phép sắp xếp cho danh sách bài viết (khớp whitelist ở core). */
export const PostSortFieldSchema = z.enum(["title", "status", "updated_at", "created_at"]);
export type PostSortField = z.infer<typeof PostSortFieldSchema>;

export const SortOrderSchema = z.enum(["asc", "desc"]);
export type SortOrder = z.infer<typeof SortOrderSchema>;
```

- [ ] **Step 2: Write failing api test**

Add to `apps/admin/src/features/posts/api.test.ts`:

```ts
it("includes sort and order", () => {
  const qs = buildPostsQuery({ sort: "title", order: "asc" });
  const sp = new URLSearchParams(qs);
  expect(sp.get("sort")).toBe("title");
  expect(sp.get("order")).toBe("asc");
});

it("omits default sort/order (created_at desc)", () => {
  expect(buildPostsQuery({ sort: "created_at", order: "desc" })).toBe("");
});
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `cd apps/admin && npx vitest run src/features/posts/api.test.ts 2>&1 | tail -8`
Expected: FAIL (sort not in query string).

- [ ] **Step 4: Extend ListPostsParams + buildPostsQuery**

In `apps/admin/src/features/posts/api.ts`, update imports to include the new types and extend the interface + builder:

```ts
import {
  PostSchema,
  PostListResponseSchema,
  PostStatsSchema,
  PostTimeseriesSchema,
  type Post,
  type PostListResponse,
  type PostStats,
  type PostTimeseries,
  type PostStatus,
  type PostSortField,
  type SortOrder,
  type UpsertPostInput,
} from "@ultimate/types";
```

```ts
export interface ListPostsParams {
  page?: number;
  pageSize?: number;
  status?: PostStatus | "";
  tag?: string;
  q?: string;
  sort?: PostSortField;
  order?: SortOrder;
}
```

In `buildPostsQuery`, before `const s = sp.toString();` add:

```ts
  // Chỉ gửi sort/order khi khác mặc định (created_at desc) để URL gọn.
  if (params.sort && !(params.sort === "created_at" && (params.order ?? "desc") === "desc")) {
    sp.set("sort", params.sort);
    sp.set("order", params.order ?? "desc");
  }
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd apps/admin && npx vitest run src/features/posts/api.test.ts 2>&1 | tail -6`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts apps/admin/src/features/posts/api.ts apps/admin/src/features/posts/api.test.ts
git commit -m "feat(types+admin): sort field/order types + query params"
```

---

### Task 4: DropdownMenu UI component

**Files:** Create `apps/admin/src/components/ui/dropdown-menu.tsx`

**Interfaces:**
- Produces: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuCheckboxItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`.

- [ ] **Step 1: Create the component**

```tsx
import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-md border border-border bg-card p-1 text-card-foreground shadow-md",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/admin && npx tsc --noEmit 2>&1 | head -10`
Expected: no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/ui/dropdown-menu.tsx
git commit -m "feat(admin/ui): radix dropdown-menu component"
```

---

### Task 5: Generic DataTable component

**Files:**
- Create: `apps/admin/src/components/ui/data-table.tsx`
- Test: `apps/admin/src/components/ui/data-table.test.tsx`

**Interfaces:**
- Consumes: dropdown-menu (Task 4).
- Produces: `DataTable<TData>` (props: `columns`, `data`, `sorting`, `onSortingChange`, `meta?`, `emptyMessage?`); module augmentation `TableMeta.onDelete`.

- [ ] **Step 1: Create DataTable**

```tsx
import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type TableMeta,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, SlidersHorizontal } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "@/lib/cn";

// Cho phép truyền handler typed qua table.options.meta (thay closure lỏng).
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends unknown> {
    onDelete: (row: TData) => void;
  }
}

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  meta?: TableMeta<TData>;
  emptyMessage?: string;
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  onSortingChange,
  meta,
  emptyMessage = "Không có dữ liệu.",
}: DataTableProps<TData>) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    state: { sorting, columnVisibility },
    onSortingChange,
    onColumnVisibilityChange: setColumnVisibility,
    ...(meta ? { meta } : {}),
  });

  const hideableColumns = table.getAllColumns().filter((c) => c.getCanHide());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal /> Cột
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Hiện cột</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hideableColumns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(v) => column.toggleVisibility(!!v)}
              >
                {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-left text-muted-foreground">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id} className="px-4 py-3 font-medium">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleFlatColumns().length}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={cn("hover:bg-secondary/30")}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write DataTable test**

Create `apps/admin/src/components/ui/data-table.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createColumnHelper, type SortingState } from "@tanstack/react-table";
import { DataTable } from "./data-table";

interface Row {
  name: string;
  age: number;
}
const helper = createColumnHelper<Row>();
const columns = [
  helper.accessor("name", { header: "Tên", enableSorting: true }),
  helper.accessor("age", { header: "Tuổi", enableSorting: false }),
] as never;

const data: Row[] = [
  { name: "An", age: 20 },
  { name: "Bình", age: 30 },
];

describe("DataTable", () => {
  it("renders headers and rows", () => {
    render(<DataTable columns={columns} data={data} sorting={[]} onSortingChange={vi.fn()} />);
    expect(screen.getByText("Tên")).toBeInTheDocument();
    expect(screen.getByText("An")).toBeInTheDocument();
    expect(screen.getByText("Bình")).toBeInTheDocument();
  });

  it("shows empty message when no data", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        sorting={[]}
        onSortingChange={vi.fn()}
        emptyMessage="Trống trơn"
      />,
    );
    expect(screen.getByText("Trống trơn")).toBeInTheDocument();
  });

  it("calls onSortingChange when a sortable header is clicked", () => {
    const onSortingChange = vi.fn();
    const sorting: SortingState = [];
    render(
      <DataTable columns={columns} data={data} sorting={sorting} onSortingChange={onSortingChange} />,
    );
    fireEvent.click(screen.getByText("Tên"));
    expect(onSortingChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test — expect PASS**

Run: `cd apps/admin && npx vitest run src/components/ui/data-table.test.tsx 2>&1 | tail -8`
Expected: 3 pass.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/ui/data-table.tsx apps/admin/src/components/ui/data-table.test.tsx
git commit -m "feat(admin/ui): generic DataTable (TanStack Table, manual sort, column visibility)"
```

---

### Task 6: Migrate PostsTable to DataTable

**Files:**
- Rewrite: `apps/admin/src/features/posts/components/PostsTable.tsx`
- Rewrite test: `apps/admin/src/features/posts/components/PostsTable.test.tsx`

**Interfaces:**
- Consumes: `DataTable` (Task 5).
- Produces: `PostsTable` props `{ posts: Post[]; onDelete: (p: Post) => void; sorting: SortingState; onSortingChange: OnChangeFn<SortingState> }`.

- [ ] **Step 1: Rewrite PostsTable with column defs**

```tsx
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { createColumnHelper, type ColumnDef, type OnChangeFn, type SortingState } from "@tanstack/react-table";
import type { Post } from "@ultimate/types";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "./StatusBadge";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(d);
}

const helper = createColumnHelper<Post>();

const columns = [
  helper.accessor("title", {
    header: "Tiêu đề",
    enableSorting: true,
    enableHiding: false,
    cell: (ctx) => {
      const p = ctx.row.original;
      return (
        <div className="max-w-xs">
          <Link to="/posts/$slug/edit" params={{ slug: p.slug }} className="font-medium hover:underline">
            {p.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
        </div>
      );
    },
  }),
  helper.accessor("status", {
    header: "Trạng thái",
    enableSorting: true,
    cell: (ctx) => <StatusBadge status={ctx.getValue()} />,
  }),
  helper.display({
    id: "tags",
    header: "Tags",
    enableSorting: false,
    cell: (ctx) => {
      const tags = ctx.row.original.tags;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            tags.map((t) => (
              <span key={t.id} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                {t.name}
              </span>
            ))
          )}
        </div>
      );
    },
  }),
  helper.accessor("updated_at", {
    header: "Cập nhật",
    enableSorting: true,
    cell: (ctx) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(ctx.getValue())}</span>,
  }),
  helper.display({
    id: "actions",
    header: () => <span className="sr-only">Thao tác</span>,
    enableSorting: false,
    enableHiding: false,
    cell: (ctx) => {
      const p = ctx.row.original;
      const onDelete = ctx.table.options.meta?.onDelete;
      return (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Sửa">
            <Link to="/posts/$slug/edit" params={{ slug: p.slug }}>
              <Pencil />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Xoá"
            onClick={() => onDelete?.(p)}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 />
          </Button>
        </div>
      );
    },
  }),
] as ColumnDef<Post, unknown>[];

export function PostsTable({
  posts,
  onDelete,
  sorting,
  onSortingChange,
}: {
  posts: Post[];
  onDelete: (post: Post) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
}) {
  return (
    <DataTable
      columns={columns}
      data={posts}
      sorting={sorting}
      onSortingChange={onSortingChange}
      meta={{ onDelete }}
      emptyMessage="Chưa có bài viết nào."
    />
  );
}
```

- [ ] **Step 2: Rewrite PostsTable.test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import type { Post } from "@ultimate/types";
import { PostsTable } from "./PostsTable";

function makePost(over: Partial<Record<keyof Post, unknown>> = {}): Post {
  return {
    id: "1",
    title: "Bài viết A",
    slug: "bai-viet-a",
    content_json: {},
    content_html: "",
    excerpt: null,
    cover_image: null,
    status: "PUBLISHED",
    meta_title: null,
    meta_desc: null,
    published_at: null,
    tags: [{ id: "t1", name: "Go", slug: "go" }],
    created_at: "2026-07-07T00:00:00Z",
    updated_at: "2026-07-07T00:00:00Z",
    ...over,
  } as unknown as Post;
}

function renderTable(posts: Post[], onDelete = vi.fn()) {
  const rootRoute = createRootRoute({ component: Outlet });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => (
      <PostsTable posts={posts} onDelete={onDelete} sorting={[]} onSortingChange={vi.fn()} />
    ),
  });
  const editRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/posts/$slug/edit",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, editRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router as never} />);
}

describe("PostsTable", () => {
  it("renders a row per post with title and tag", async () => {
    renderTable([makePost(), makePost({ id: "2", title: "Bài viết B", slug: "b" })]);
    expect(await screen.findByText("Bài viết A")).toBeInTheDocument();
    expect(screen.getByText("Bài viết B")).toBeInTheDocument();
    expect(screen.getAllByText("Go")).toHaveLength(2);
  });

  it("shows empty state when there are no posts", async () => {
    renderTable([]);
    expect(await screen.findByText(/Chưa có bài viết/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests — expect PASS**

Run: `cd apps/admin && npx vitest run src/features/posts/components/PostsTable.test.tsx 2>&1 | tail -8`
Expected: 2 pass.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/features/posts/components/PostsTable.tsx apps/admin/src/features/posts/components/PostsTable.test.tsx
git commit -m "refactor(admin): PostsTable uses generic DataTable + typed columns"
```

---

### Task 7: Wire sorting through PostsListPage + route search

**Files:**
- Modify: `apps/admin/src/routes/_authed.posts.index.tsx` (search schema + loader deps)
- Modify: `apps/admin/src/features/posts/PostsListPage.tsx`

**Interfaces:**
- Consumes: `PostsTable` (Task 6) sorting props; `buildPostsQuery` sort/order (Task 3).

- [ ] **Step 1: Extend route search schema + loader**

In `apps/admin/src/routes/_authed.posts.index.tsx`, update the imports and schema:

```ts
import { PostSortFieldSchema, SortOrderSchema } from "@ultimate/types";
```

```ts
const searchSchema = z.object({
  page: z.number().int().min(1).default(1).catch(1),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "PUBLISHED"]).or(z.literal("")).default("").catch(""),
  tag: z.string().default("").catch(""),
  q: z.string().default("").catch(""),
  sort: PostSortFieldSchema.default("created_at").catch("created_at"),
  order: SortOrderSchema.default("desc").catch("desc"),
});
```

Update the loader to pass sort/order:

```ts
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient.ensureQueryData(tagsQueryOptions());
    return queryClient.ensureQueryData(
      postsListQueryOptions({
        page: deps.page,
        pageSize: PAGE_SIZE,
        status: deps.status,
        tag: deps.tag,
        q: deps.q,
        sort: deps.sort,
        order: deps.order,
      }),
    );
  },
```

- [ ] **Step 2: Wire sorting state in PostsListPage**

In `apps/admin/src/features/posts/PostsListPage.tsx`:

Add imports:

```ts
import type { SortingState, OnChangeFn } from "@tanstack/react-table";
```

Add the query params (sort/order) to the `usePostsListSuspense({...})` call:

```ts
  const postsQuery = usePostsListSuspense({
    page: search.page,
    pageSize: PAGE_SIZE,
    status: search.status as PostStatus | "",
    tag: search.tag,
    q: search.q,
    sort: search.sort,
    order: search.order,
  });
```

Derive sorting state + change handler (place above the `return`):

```ts
  const sorting: SortingState = [{ id: search.sort, desc: search.order === "desc" }];
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    const first = next[0];
    void navigate({
      search: (p) => ({
        ...p,
        sort: (first?.id as typeof p.sort) ?? "created_at",
        order: first ? (first.desc ? "desc" : "asc") : "desc",
        page: 1,
      }),
    });
  };
```

Pass to `PostsTable`:

```tsx
      <PostsTable
        posts={postsQuery.data.data}
        onDelete={setToDelete}
        sorting={sorting}
        onSortingChange={onSortingChange}
      />
```

- [ ] **Step 3: Regenerate route tree + typecheck**

```bash
cd apps/admin
pnpm dev & sleep 5; kill %1
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/routes/_authed.posts.index.tsx apps/admin/src/features/posts/PostsListPage.tsx apps/admin/src/routeTree.gen.ts
git commit -m "feat(admin): sortable posts table via URL search (manual TanStack Table)"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Core tests**

Run: `cd services/core && TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable" go test -count=1 ./... 2>&1 | tail -6`
Expected: all `ok`.

- [ ] **Step 2: Admin tests + typecheck + build**

Run: `cd apps/admin && pnpm test 2>&1 | tail -6 && npx tsc --noEmit && pnpm build 2>&1 | tail -4`
Expected: all vitest pass, tsc clean, build succeeds.

- [ ] **Step 3: E2E (browser, real login) — checklist**
  1. `/posts` — click **Tiêu đề** header → URL gains `sort=title&order=asc`, list reorders (asc), click again → `order=desc`.
  2. Click **Trạng thái** / **Cập nhật** headers → sort switches; page resets to 1.
  3. **Cột** dropdown → uncheck "Tags" → tags column disappears; recheck → returns.
  4. Filter/search/pagination still work and combine with sort in the URL.

---

### Task 9: Docs + Artifact

**Files:**
- Modify: `CLAUDE.md`, `docs/personal-blog-ai-analysis.md`, `docs/personal-blog-ai-analysis.html`
- Artifact: update existing URL

- [ ] **Step 1: CLAUDE.md**

In the admin stack line, append TanStack Table. After the Slice 3d bullet add:

```
- ✅ **Slice 3e — DONE**: bảng dữ liệu dùng **TanStack Table** qua component `DataTable<TData>` chung (headless, manual server-side sort/pagination/filter, column visibility toggle); `PostsTable` migrate sang column defs typed (`createColumnHelper`, `TableMeta.onDelete`); core thêm sort/order (whitelist ORDER BY); sort state ở URL search.
  Spec: `docs/superpowers/specs/2026-07-08-slice3e-tanstack-table-design.md`.
```

- [ ] **Step 2: analysis .md**

In `docs/personal-blog-ai-analysis.md`, in the admin stack table (near the Routing row, ~line 130) add a row:

```
| Data table | **TanStack Table** (headless) | Bảng typed, server-side sort/pagination/filter (manual mode), ẩn/hiện cột. |
```

And in §14.3 add a bullet:

```
- **Bảng dữ liệu:** TanStack Table (headless) qua `DataTable<TData>` dùng chung — sort server-side theo URL, column visibility.
```

- [ ] **Step 3: analysis .html (mirror)**

In `docs/personal-blog-ai-analysis.html`, add the matching table row after the Routing row (~line 360):

```html
          <tr><td>Data table</td><td><b>TanStack Table</b> (headless)</td><td>Bảng typed, server-side sort/pagination/filter, ẩn/hiện cột.</td></tr>
```

And add a bullet in the 14.3 `<ul>` (after the Routing `<li>`):

```html
        <li><strong>Bảng dữ liệu:</strong> TanStack Table (headless) qua <code>DataTable&lt;TData&gt;</code> dùng chung — sort server-side theo URL, column visibility.</li>
```

- [ ] **Step 4: Commit docs**

```bash
git add CLAUDE.md docs/personal-blog-ai-analysis.md docs/personal-blog-ai-analysis.html
git commit -m "docs: mark Slice 3e done; admin data tables use TanStack Table"
```

- [ ] **Step 5: Update Artifact**

Use the Artifact tool with `file_path` = `docs/personal-blog-ai-analysis.html`, `url` = `https://claude.ai/code/artifact/3c7c4f92-7a5f-467a-8c1c-896a5e6f8530`, favicon `📐`, label `slice-3e-tanstack-table`.

---

## Self-review notes

- Spec coverage: manual mode (T5), core sort whitelist (T2), types (T3), DataTable + column visibility (T5), TableMeta.onDelete augmentation (T5/T6), createColumnHelper (T6), URL sort state (T7), tests (T2/T3/T5/T6/T8), docs+artifact (T9). All covered.
- Type consistency: `ListPostsParams.sort: PostSortField`, route search `sort` uses `PostSortFieldSchema` (same enum), `PostsTable` sorting props `SortingState`/`OnChangeFn<SortingState>` match `DataTable` + `PostsListPage`.
- Risk: `as ColumnDef<Post, unknown>[]` cast on the columns array is needed because `createColumnHelper` accessor/display defs form a union; the cast is localized and safe (all defs are for `Post`).
