# Slice 2 — Auth Google OAuth (BFF)

> Spec triển khai · Ngày 2026-07-05 · Dự án `ultimate-website`
> Slice thứ 2 của Phase 1. Xem thêm `docs/personal-blog-ai-analysis.md` §14.4 và spec Slice 1.

## 1. Mục tiêu & phạm vi

Thêm đăng nhập admin bằng **Google OAuth theo BFF pattern**: Go core là OAuth client, đổi
authorization code, kiểm tra allowlist email, tạo **session server-side** và set **cookie
httpOnly**. Bảo vệ các endpoint ghi của `posts` bằng middleware.

**Trong phạm vi:**
- Module `internal/modules/auth`: login → callback → session; logout; me.
- Allowlist email qua env.
- Session server-side lưu Postgres (thư viện **scs** + postgres store).
- Middleware `RequireAuth` bọc **POST/PUT/DELETE /posts** (gỡ `TODO(slice-2)`).
- Cookie `SameSite` + `Secure` cấu hình được qua env (mặc định `Lax` / secure theo môi trường).

**Ngoài phạm vi:**
- Chạy thật với Google (defer — spec kèm hướng dẫn setup Google Cloud Console). Test tự động dùng **fake provider**.
- Refresh token / phiên dài hạn nâng cao, đa admin quản lý qua UI (allowlist là env).
- `apps/admin` SPA (Slice 3).

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Session store | **Postgres** qua `alexedwards/scs` + `postgresstore` |
| Allowlist | **Env** `ADMIN_ALLOWLIST` (CSV email, so khớp lowercase) |
| OAuth lib | `golang.org/x/oauth2` + `oauth2/google` (sau interface `OAuthProvider`) |
| Verify | **Fake provider** cho test tự động; Google thật defer |
| Cookie SameSite/Secure | Mặc định `Lax` / secure theo `APP_ENV`; **override qua env** |

## 3. Kiến trúc module `auth` (Clean-lite)

```
internal/modules/auth/
├── provider.go        # interface OAuthProvider + GoogleProvider (thật)
├── provider_google.go # impl Google (oauth2 + đọc email)
├── allowlist.go       # parse env, IsAllowed(email)
├── service.go         # StartLogin / CompleteLogin (business logic)
├── handler.go         # Gin: login, callback, logout, me
├── middleware.go      # RequireAuth
└── *_test.go
```

- **`OAuthProvider`** (port):
  ```go
  type Identity struct { Email string; EmailVerified bool; Sub string; Name string }
  type OAuthProvider interface {
      AuthCodeURL(state, verifier string) string
      Exchange(ctx context.Context, code, verifier string) (Identity, error)
  }
  ```
  `GoogleProvider` dùng `oauth2.Config` (endpoint google) + PKCE (`oauth2.S256ChallengeOption`/verifier), đọc email từ **id_token** (OIDC) hoặc userinfo endpoint.
- **`allowlist.go`**: `NewAllowlist(csv string)`, `IsAllowed(email string) bool` (trim + lowercase). *(TDD)*
- **`service.go`**:
  - `StartLogin() (state, verifier, url string)` — sinh `state` (random) + PKCE `verifier`, trả URL redirect.
  - `CompleteLogin(ctx, code, gotState, wantState, verifier) (Identity, error)`:
    validate `gotState == wantState` (`ErrStateMismatch`); `Exchange`; bắt buộc `EmailVerified` (`ErrEmailNotVerified`); `allowlist.IsAllowed` (`ErrNotAllowed`). *(TDD với fake provider)*
- **`handler.go`** (dùng `*scs.SessionManager`):
  - `GET /auth/google/login`: `StartLogin` → lưu `state`,`verifier` vào session → 302 tới URL Google.
  - `GET /auth/google/callback?code&state`: đọc `state`/`verifier` từ session → `CompleteLogin` → `RenewToken` + lưu `admin_email` vào session → 302 về `APP_BASE_URL`. Lỗi → 401/403 + xoá dữ liệu tạm.
  - `POST /auth/logout`: `Destroy` session → 204.
  - `GET /auth/me`: có session → `{email}`; không → 401.
- **`middleware.go`**: `RequireAuth(sm)` — `sm.GetString(ctx,"admin_email")` rỗng → `401 UNAUTHORIZED`; ngược lại `c.Next()`.

## 4. Session (scs + Postgres)

- `platform/session/session.go`: `New(db *sql.DB, cfg) *scs.SessionManager`; cấu hình:
  - store: `postgresstore.New(db)` (scs cần `*sql.DB` — lấy từ GORM: `gormDB.DB()`).
  - `Cookie.HttpOnly = true`, `Cookie.Path = "/"`, `Cookie.SameSite` + `Cookie.Secure` theo cfg.
  - `Lifetime` (vd 7 ngày).
  - Router bọc bằng `sm.LoadAndSave(...)` (adapter cho Gin qua `gin.WrapH`/middleware chuẩn `net/http`).
- **Bảng `sessions`**: khai báo bằng **GORM model** để Atlas quản lý (thêm vào loader), khớp schema scs:
  ```
  sessions(token text PRIMARY KEY, data bytea NOT NULL, expiry timestamptz NOT NULL)
  index idx_sessions_expiry ON expiry
  ```
  scs dùng bảng này runtime; Atlas không drop vì đã có trong model.

## 5. Config thêm (env)

| Env | Ý nghĩa | Mặc định |
|---|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client id | (bắt buộc khi bật auth thật) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | (bắt buộc khi bật auth thật) |
| `GOOGLE_REDIRECT_URL` | URL callback | `http://localhost:8080/auth/google/callback` |
| `ADMIN_ALLOWLIST` | CSV email admin | (rỗng = không ai vào được) |
| `APP_BASE_URL` | redirect về sau login | `http://localhost:8080` |
| `SESSION_COOKIE_SAMESITE` | `lax` \| `none` \| `strict` | `lax` |
| `SESSION_COOKIE_SECURE` | `true` \| `false` | `true` nếu `APP_ENV=production`, else `false` |

Cập nhật `.env.example`. Thiếu Google creds/allowlist thì các route `/auth/*` vẫn đăng ký nhưng login sẽ fail có kiểm soát (log rõ) — không chặn server khởi động (để dev posts vẫn chạy).

## 6. Wiring bảo vệ posts

- Đổi `posts.RegisterRoutes(rg gin.IRouter)` → `RegisterRoutes(rg gin.IRouter, writeMW ...gin.HandlerFunc)`.
- Áp `writeMW` cho `POST /posts`, `PUT /posts/:id`, `DELETE /posts/:id`. `GET` giữ công khai.
- `main.go`: khởi tạo scs, provider, service, handler auth; đăng ký `/auth/*`; truyền `auth.RequireAuth(sm)` vào `posts.RegisterRoutes`. Bọc router bằng `sm.LoadAndSave`.

## 7. Testing (TDD)

Dùng **scs memstore** + **fake provider** → phần lớn test không cần DB.

- `allowlist_test` (unit): allow/deny, khoảng trắng, case-insensitive, list rỗng → deny hết.
- `service_test` (fake provider): state khớp/không khớp; email chưa verified → lỗi; ngoài allowlist → lỗi; hợp lệ → trả Identity.
- `middleware_test`: có `admin_email` trong session → pass; không → 401.
- `handler_test` (memstore + fake): `login` → 302 tới URL có `state`; `callback` hợp lệ → set session + 302; `me` → email; `logout` → 204; **`POST /posts` không session → 401** (test tích hợp posts + middleware).

## 8. Tiêu chí hoàn thành (DoD)

1. `go test ./...` xanh (auth chủ yếu không cần DB nhờ memstore).
2. Migration `sessions` sinh bởi Atlas + apply thành công.
3. Chạy server end-to-end (không cần Google thật):
   - `GET /auth/google/login` → **302** tới `accounts.google.com/...` có `state` + `code_challenge`.
   - `POST /api/v1/posts` khi chưa đăng nhập → **401**.
   - `GET /api/v1/posts` vẫn **200**.
4. Spec kèm hướng dẫn tạo Google OAuth client (Console) + set env để chạy thật.

## 9. Hướng dẫn setup Google (để chạy thật sau)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.
2. Authorized redirect URI: `http://localhost:8080/auth/google/callback` (và URL prod sau này).
3. Lấy Client ID + Secret → đặt vào `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
4. Đặt `ADMIN_ALLOWLIST` = email Google của bạn.
5. (OAuth consent screen: External, thêm email của bạn vào Test users nếu app chưa publish.)

## 10. Ranh giới slice sau
- **Slice 3:** `apps/admin` (Vite SPA) gọi `/auth/google/login`, dùng cookie session cho API; module `media` (presigned R2/MinIO) + Tiptap.
- **Slice 4:** `apps/web` (Next.js) public.
