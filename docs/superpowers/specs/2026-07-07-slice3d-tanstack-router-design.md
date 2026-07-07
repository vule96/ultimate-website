# Slice 3d — Migrate admin routing sang TanStack Router

> Spec triển khai · Ngày 2026-07-07 · Dự án `ultimate-website`
> Nhánh `slice-3d-tanstack-router` build trên `slice-3c-editor-media` (3c chưa merge).

## 1. Mục tiêu & phạm vi

Thay `react-router-dom` bằng **TanStack Router** cho `apps/admin`, dùng file-based routes,
type-safe search params, route loaders tích hợp TanStack Query, và auth guard chuẩn
`beforeLoad`. Hành vi người dùng giữ nguyên; chỉ đổi tầng routing + cách nạp dữ liệu.
Cập nhật doc `.md`, `.html`, và Artifact.

**Ngoài phạm vi:** đổi UI/tính năng; đụng backend Go; `apps/web` (Slice 4).

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Route style | File-based (`src/routes/` + `@tanstack/router-plugin` Vite + `routeTree.gen.ts`) |
| Data | Route loaders + `queryClient.ensureQueryData`; refactor query → `queryOptions` dùng chung |
| Auth | `/auth/me` thành TanStack Query; `_authed.beforeLoad` → `ensureQueryData(auth)`, guest thì `throw redirect('/login')`; bỏ AuthProvider context |
| Search params | `validateSearch` bằng Zod cho `/posts` (page/status/tag/q) |
| Component data | `useSuspenseQuery` cho route có loader + `pendingComponent`/`errorComponent` ở route |
| `routeTree.gen.ts` | Commit vào repo (để `tsc --noEmit` chạy trước `vite build` không lỗi) |

## 3. Cây route (file-based)

```
apps/admin/src/routes/
├── __root.tsx                    # rootRouteWithContext<{ queryClient }>; <Outlet/> + devtools (dev)
├── login.tsx                     # /login (public); nếu đã auth → redirect '/'
├── _authed.tsx                   # layout pathless: beforeLoad ensureQueryData(auth) → redirect nếu guest; render AppShell
├── _authed.index.tsx             # /            (Dashboard); loader prefetch stats + timeseries + recent
├── _authed.posts.index.tsx       # /posts       validateSearch + loaderDeps(search) + loader listPosts
├── _authed.posts.new.tsx         # /posts/new
└── _authed.posts.$slug.edit.tsx  # /posts/:slug/edit; loader getPostBySlug
```

- `main.tsx`: `const router = createRouter({ routeTree, context: { queryClient } })`, bọc
  `<QueryClientProvider>` + `<ToastProvider>` + `<RouterProvider router={router} />`.
- Type-safe toàn cục: `declare module '@tanstack/react-router' { interface Register { router: typeof router } }`.

## 4. Refactor query → queryOptions

Chuyển `features/*/queries.ts` sang export `queryOptions` factory (từ `@tanstack/react-query`):
- posts: `postsListQueryOptions(params)`, `postQueryOptions(slug)`, `statsQueryOptions`,
  `timeseriesQueryOptions(months)`, `tagsQueryOptions`.
- auth: `authQueryOptions` (`retry: false`).

Loader gọi `context.queryClient.ensureQueryData(...)`. Component gọi `useSuspenseQuery(...)`
(data đã có từ loader). Mutations (`useCreatePost`/`useUpdatePost`/`useDeletePost`) giữ nguyên,
tiếp tục `invalidateQueries({ queryKey: postKeys.all })`.

## 5. Auth

- Giữ `features/auth/api.ts::fetchMe`; thêm `authQueryOptions` (`queryKey: ['auth','me']`, `retry:false`).
- Xoá `AuthProvider.tsx`, `ProtectedRoute.tsx`, `context.ts` (React context).
- `_authed.tsx`:
  ```ts
  beforeLoad: async ({ context, location }) => {
    try { await context.queryClient.ensureQueryData(authQueryOptions); }
    catch { throw redirect({ to: '/login', search: { redirect: location.href } }); }
  }
  ```
- Hook `useAuth()` mới = `useSuspenseQuery(authQueryOptions)` (giữ tên để Sidebar/Dashboard ít sửa;
  trả `{ user }`). Chỉ dùng dưới `_authed` nên auth luôn có.
- `signOut`: mutation gọi `/auth/logout` → `queryClient.clear()` → `navigate({ to: '/login' })`.
- `login.tsx`: nút Google giữ logic `window.location.assign(googleLoginUrl)`; `beforeLoad` nếu đã
  auth → `redirect({ to: '/' })`.

## 6. Ánh xạ API react-router → TanStack Router

| react-router-dom | TanStack Router |
|---|---|
| `createBrowserRouter` / `RouterProvider` | `createRouter` / `RouterProvider` |
| `Outlet` | `Outlet` |
| `Link to` | `Link to` (typed `to` + `params` + `search`) |
| `NavLink` (Sidebar) | `Link` + `activeProps` (hoặc `data-status="active"`) |
| `useNavigate` | `useNavigate` (typed) |
| `useParams` | `Route.useParams()` |
| `useSearchParams` (PostsList) | `Route.useSearch()` + `navigate({ search })` |
| `<Navigate>` (ProtectedRoute) | `redirect()` trong `beforeLoad` |

**File đụng tới:** xoá `router.tsx`, `AuthProvider.tsx`, `ProtectedRoute.tsx`, `context.ts`;
sửa `main.tsx`, `AppShell.tsx`, `Sidebar.tsx`, `LoginPage.tsx`, `PostsListPage.tsx`,
`PostFormPage.tsx`, `PostsToolbar.tsx`, `PostsTable.tsx`, `RecentPosts.tsx`; thêm `src/routes/*`.

## 7. Search params (posts list)

```ts
const postsSearchSchema = z.object({
  page: z.number().int().min(1).catch(1),
  status: z.enum(['DRAFT','PENDING_APPROVAL','PUBLISHED']).or(z.literal('')).catch(''),
  tag: z.string().catch(''),
  q: z.string().catch(''),
});
```
- `_authed.posts.index.tsx`: `validateSearch: postsSearchSchema`, `loaderDeps: ({search}) => search`,
  `loader: ({context, deps}) => context.queryClient.ensureQueryData(postsListQueryOptions(deps))`.
- Component: `const search = Route.useSearch()`; cập nhật filter/search/page bằng
  `navigate({ search: (prev) => ({ ...prev, ... }) })`. Debounce search giữ nguyên ý tưởng (local state → navigate sau 300ms).

## 8. Build / tooling

- Thêm deps: `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/router-devtools` (dev).
  Gỡ `react-router-dom`.
- `vite.config.ts`: thêm `TanStackRouterVite()` (trước `react()`).
- `routeTree.gen.ts`: plugin sinh tự động; **commit** vào repo. Thêm vào prettier/eslint ignore.
- `package.json` scripts giữ `build: tsc --noEmit && vite build` (routeTree đã commit nên tsc chạy được).

## 9. Test

- Xoá `ProtectedRoute.test.tsx` (guard chuyển sang `beforeLoad`).
- `PostsTable.test.tsx`: thay `MemoryRouter` bằng helper render TanStack (tạo memory router tối thiểu
  bọc `<Link>`), hoặc render trong một `RouterProvider` stub. `PostsTable` vốn nhận handler thuần nên
  chỉ cần provider cho `<Link>`.
- Giữ nguyên: `posts/api.test`, `posts/formSchema.test`, `media/api.test`, `editor/config.test`.
- **DoD:** `tsc --noEmit` + `vitest` + `vite build` xanh. E2E (đăng nhập):
  1. Guest mở `/posts` → bị đẩy `/login`.
  2. Đăng nhập → vào `/` (Dashboard), số liệu + chart hiện.
  3. `/posts`: filter/search/pagination phản ánh trên URL, back/forward hoạt động.
  4. Tạo/sửa/xoá bài + editor (Tiptap/Lexical) + upload ảnh vẫn chạy.
  5. `signOut` → về `/login`, không vào lại được route trong `_authed`.

## 10. Docs / HTML / Artifact

- `CLAUDE.md`: đổi mô tả admin "React Router" → "TanStack Router (file-based)"; đánh dấu 3d done.
- `docs/personal-blog-ai-analysis.md` (§2.2, §14): cập nhật stack routing admin.
- Cập nhật bản `.html` tương ứng.
- **Hỏi trước khi publish lại Artifact** (theo quy ước repo: sửa `.md` → hỏi trước khi cập nhật `.html`/Artifact).

## 11. Rủi ro & giảm thiểu

- **Codegen vs tsc order:** commit `routeTree.gen.ts` (plugin vẫn regen khi dev/build).
- **useSuspenseQuery đổi loading/error:** dùng route `pendingComponent`/`errorComponent`; bỏ if/else
  loading rải rác trong component.
- **Test cần router provider:** viết helper `renderWithRouter` nhỏ.
- **beforeLoad + auth async:** auth là query có cache; `ensureQueryData` chỉ fetch lần đầu, các lần sau
  đọc cache → guard nhanh.
