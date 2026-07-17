# Slice 13 — Backend consumer Mạch (reader auth + bookmark + newsletter + rate limit + view dedupe)

**Ngày:** 2026-07-17
**Trạng thái:** Design (đã duyệt qua brainstorm)
**Mục tiêu:** thay các mock localStorage của trang chủ Mạch (Slice 6) bằng backend thật, tận dụng seam interface đã dựng sẵn (`bookmark-service.ts`, `newsletter-service.ts`, auth mock trong `magazine-store`). Nhân tiện trả 2 nợ từ Slice 9: rate limit Redis cho endpoint public + dedupe view per-user.

## Bối cảnh & quyết định đã chốt (brainstorm)

- **Reader auth**: Google OAuth tái dùng BFF sẵn có (`OAuthProvider` + `scs`). **Session key riêng** (`reader_id`) tách khỏi admin (`admin_email`). **KHÔNG allowlist** — ai có Google đều đăng nhập.
- **Newsletter**: subscriber **độc lập**, KHÔNG cần login (giữ UX band nhập email hiện tại).
- **Phạm vi**: cả **4 mảng** (auth + bookmark + newsletter + rate limit + view dedupe).
- **View dedupe**: Redis SET + TTL (chính xác, tự dọn) — không HyperLogLog, không cookie.

## A. Data model — module `readers` (3 bảng, 1 migration Atlas)

Module Go mới `internal/modules/readers` (clean-lite: domain → service → repository → handler), tách hẳn `auth` (admin).

```
readers(
  id          uuid pk default gen_random_uuid(),
  google_sub  text not null unique,       -- subject id ổn định từ Google
  email       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
)
bookmarks(
  reader_id   uuid not null references readers(id) on delete cascade,
  post_id     uuid not null references posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (reader_id, post_id)
)
subscribers(
  id          uuid pk default gen_random_uuid(),
  email       citext not null unique,      -- citext: chống trùng hoa/thường
  status      text not null default 'active',   -- active | unsubscribed
  created_at  timestamptz not null default now()
)
```

- `citext` cần extension `CREATE EXTENSION IF NOT EXISTS citext` trong migration (Postgres đã có sẵn extension này).
- Migration Atlas theo quy trình `--env gorm` như các slice trước.

## B. Reader auth — BFF (session key `reader_id`)

Handler `readers.AuthHandler`, tái dùng `OAuthProvider` + `scs.SessionManager` (inject qua wiring, không import chéo `auth`). Session key riêng:

```
const sessionKeyReaderID  = "reader_id"
const sessionKeyReaderState    = "reader_oauth_state"
const sessionKeyReaderVerifier = "reader_oauth_verifier"
const sessionKeyReaderReturnTo = "reader_return_to"
```

Route:
- `GET /auth/reader/google/login` — nhận `?returnTo=<path>`, validate open-redirect (chỉ path nội bộ bắt đầu `/`, không `//`, không scheme) → lưu session; `StartLogin()` (state+PKCE) → lưu key reader → redirect Google.
- `GET /auth/reader/google/callback` — verify state/verifier (key reader), `Exchange` → `Identity`. **Không cần `EmailVerified` gate bắt buộc** như admin? → vẫn giữ gate `EmailVerified` (an toàn, tránh email giả). Upsert `readers` theo `google_sub` (email/name cập nhật). `RenewToken` (chống fixation) → `Put(reader_id, id)` → redirect về `returnTo` đã lưu (hoặc web base URL nếu trống/không hợp lệ).
- `POST /auth/reader/logout` — chỉ gỡ phần reader: `Remove(reader_id)` + `RenewToken`. KHÔNG `Destroy` toàn session (giữ admin nếu lỡ đăng nhập chung browser).
- `GET /auth/reader/me` — đọc `reader_id`; rỗng → 401 `UNAUTHORIZED`. Có → load reader từ repo, trả `{id, email, name}`. Reader bị xoá khỏi DB → 401 + gỡ session.

Middleware `readers.RequireReader(sm)` — chặn request nếu `reader_id` rỗng (401). Bọc route bookmark. Đặt `reader_id` vào gin context để handler bookmark dùng.

## C. Bookmark (cần reader session)

Handler bọc `RequireReader`:
- `GET /readers/me/bookmarks` → `["<postId>", ...]` (list post_id của reader; chỉ trả id, FE đã có post data).
- `PUT /readers/me/bookmarks/:postId` → 204. Idempotent: `ON CONFLICT (reader_id, post_id) DO NOTHING`. Validate `postId` là uuid hợp lệ (không cần check post tồn tại — FK lo; post bị xoá → cascade dọn).
- `DELETE /readers/me/bookmarks/:postId` → 204 (xoá không tồn tại vẫn 204, idempotent).

Repo: `List(readerID)`, `Add(readerID, postID)`, `Remove(readerID, postID)`.

## D. Newsletter (public)

Handler `readers.SubscriberHandler` (không auth, có rate limit + RequireJSON):
- `POST /subscribers` `{ "email": "..." }` → validate email (regex/`net/mail.ParseAddress`); hợp lệ → upsert `ON CONFLICT (email) DO NOTHING` (nếu từng unsubscribe → giữ nguyên trạng thái, không tự re-activate ở slice này). Trả **201 luôn** dù đã tồn tại — **không leak** "email đã đăng ký" (privacy). Email không hợp lệ → 400 `INVALID_EMAIL`.

## E. Rate limit — `shared/ratelimit` (Redis, fixed-window per-IP)

Middleware factory `ratelimit.PerIP(rdb, scope string, limit int, window time.Duration)`:
- Key `rl:{scope}:{ip}:{floor(now/window)}`. `INCR` → nếu == 1 thì `EXPIRE window`. Vượt `limit` → 429 `RATE_LIMITED` + header `Retry-After` (giây còn lại của window).
- IP lấy từ `c.ClientIP()` (Gin đã cấu hình trusted proxies — kiểm tra config; nếu chưa, set `SetTrustedProxies` phù hợp reverse proxy).
- **Fail-open**: Redis lỗi → log warn + cho qua (không chặn user thật). Metric `ratelimit_hits_total{scope,result}` (allowed|blocked|error) nếu gọn.

Áp dụng:
| Endpoint | scope | limit |
|---|---|---|
| `GET /auth/reader/google/login` | `auth` | 10 / phút |
| `POST /subscribers` | `subscribe` | 5 / phút |
| `POST /posts/:id/view` | `view` | 60 / phút |

Callback không rate-limit (state gate đã chống abuse; login đã limit).

## F. View dedupe — Redis SET + TTL

Trong handler `POST /posts/:id/view` (module posts), **trước** khi đẩy vào batch counter:
- Định danh: `reader_id` nếu có session, else `sha256(clientIP + salt)` (salt từ env, tránh reverse IP). Prefix phân biệt: `r:<id>` / `a:<hash>`.
- Key `views:seen:{postId}:{yyyymmdd}` (theo ngày UTC). `SADD key member`.
- `SADD` trả 1 (mới trong ngày) → đẩy vào batch counter (tăng view). Trả 0 (đã xem) → bỏ qua, vẫn trả 202/204 cho client (không lộ dedupe).
- `EXPIRE key 48h` sau SADD lần đầu (chỉ set khi key mới — dùng `SADD` rồi `EXPIRE` NX, hoặc set expire mỗi lần cũng chấp nhận được vì rẻ).
- **Fail-open**: Redis lỗi → đếm bình thường (thà đếm dư hơn mất view).
- Posts module nhận Redis client + salt qua wiring; nếu Redis nil (dev không bật) → skip dedupe (đếm hết như cũ).

## G. Wiring (`cmd/api` / bootstrap)

- Khởi tạo `readers` module: repo(db) → service(repo, provider, ...) → authHandler + bookmarkHandler + subscriberHandler; đăng ký routes. Provider Google tái dùng cấu hình OAuth hiện có (client id/secret/redirect — **redirect URI riêng cho reader callback** phải thêm vào Google Console + env `OAUTH_READER_REDIRECT_URL` hoặc suy ra từ base).
- Redis client (đã có từ Slice 9 cache) inject vào ratelimit middleware + posts dedupe.
- Env mới: `VIEW_DEDUP_SALT` (fail-fast nếu rỗng khi Redis bật), `WEB_BASE_URL` (redirect reader về web — có thể đã có). Cập nhật `.env.example` + `Config` + `LogValue` redact.

## H. Frontend (`apps/web`)

- **Auth modal** (`auth-modal.tsx`): bỏ form mock name+email + login/register mode → nút **"Tiếp tục với Google"** = anchor tới `${API_URL}/auth/reader/google/login?returnTo=<pathname hiện tại>`. Full-page redirect (đúng BFF). Giữ modal làm launcher + copy giới thiệu. i18n keys mới qua `i18n:gen`.
- **Store** (`magazine-store.ts`):
  - Bỏ `MockUser`/`authMode` login/register nếu không còn dùng (giữ `authOpen` cho modal). `user` type = `{id, email, name}` thật.
  - `hydrate()` (gọi lúc mount client, ví dụ trong `MagazineBoard` effect): `GET /auth/reader/me` → set user; nếu có user → `GET /readers/me/bookmarks` → set `saved`.
  - `toggleSave(id)`: nếu chưa login → mở auth (như cũ). Nếu login → **optimistic**: set saved ngay + `PUT`/`DELETE` API; lỗi → rollback + toast lỗi.
  - `logout()`: `POST /auth/reader/logout` → clear user + saved.
- **bookmark-service.ts**: thêm `apiBookmarkService` implement `BookmarkService` (hoặc đổi interface sang async — vì API async). → interface chuyển async: `load(): Promise<Set>`, `add/remove(postId): Promise<void>`. Cập nhật local impl + store. Flip sang API impl.
- **newsletter-service.ts**: thêm `apiNewsletterService.subscribe(email)` → `POST /subscribers`. Flip sang API impl.
- **ViewTracker**: giữ nguyên beacon; credentials `include` để gửi session cookie (dedupe theo reader nếu login). CSP `connect-src` core API đã mở (Slice 10).
- Fetch cần `credentials: "include"` + CORS core cho phép credentials từ origin web (kiểm tra CORS config — hiện cho admin origin; **thêm web origin** vào allowlist CORS + `AllowCredentials`).
- Không migrate dữ liệu (chỉ mock localStorage cũ — bỏ).

## I. Kiểm thử (TDD)

**Go** (fake Redis = miniredis, fake `OAuthProvider` có sẵn, DB test `blog_test`):
- `readers` service: upsert theo google_sub (tạo mới / cập nhật email-name), `me` khi reader bị xoá.
- bookmark repo/service: add idempotent, remove idempotent, list.
- subscriber: upsert idempotent, email invalid → lỗi, không leak tồn tại (handler trả 201 cả 2 lần).
- `ratelimit.PerIP`: dưới ngưỡng pass, vượt → 429 + Retry-After, window rollover reset, Redis lỗi → fail-open.
- view dedupe: SADD mới → count, dup → skip, TTL set, Redis nil → count hết.
- auth handler: `/me` 401 khi thiếu session; callback open-redirect guard (returnTo `//evil` → về base).

**Web** (vitest):
- store `hydrate` (me + bookmarks), `toggleSave` optimistic + rollback khi API lỗi, `logout`.
- auth modal render đúng link `returnTo`.
- newsletter service gọi đúng endpoint (mock fetch).

## J. Verify E2E (live)

- Docker Redis + Postgres + core + web. Migration applied.
- Đăng nhập Google thật qua modal → callback → `/auth/reader/me` trả user → header hiện tên.
- Bookmark: save/unsave 1 bài → DB `bookmarks` có/mất row; reload → giữ trạng thái (hydrate từ API).
- Newsletter: submit email → row `subscribers`; submit lại → vẫn 201, không lộ; email rác → lỗi inline.
- Rate limit: spam `POST /subscribers` >5/phút → 429 + Retry-After (curl).
- View dedupe: gọi `POST /posts/:id/view` 2 lần cùng session → views chỉ +1 (sau batch flush); Redis check key `views:seen:*`. Tắt Redis → API vẫn 200, đếm bình thường (fail-open).
- Dark + `/en` chrome dịch đủ.

## K. Nợ / rủi ro ghi nhận (nhận xét chuyên gia cuối slice)

- **CSRF**: bookmark PUT/DELETE + subscribe POST là state-changing → `RequireJSON` (đã có, chặn simple-request) + SameSite cookie. Login là GET redirect (không body) — an toàn. Cân nhắc CSRF token nếu sau này có form.
- **returnTo open-redirect**: bắt buộc guard (helper admin đã có mẫu). Test riêng.
- **Trusted proxies / ClientIP**: rate limit + dedupe theo IP chỉ đúng nếu Gin `SetTrustedProxies` khớp reverse proxy production (VPS + Nginx/Cloudflare) — note cho slice deploy.
- **Google Console**: thêm reader redirect URI (dev + prod) — thao tác ngoài code.
- **Subscriber re-activate + unsubscribe link**: slice này chỉ subscribe; unsubscribe (link email + token) là backlog Phase 2 (khi có AI worker gửi mail).
- **Reader profile / xoá tài khoản (GDPR)**: chưa làm — backlog.

## Ngoài phạm vi

- Unsubscribe flow, email gửi thật (Phase 2 AI worker). Magic link auth (đã bác ở brainstorm). Reader profile page, avatar. Comment/like (chưa có). Migrate localStorage cũ.
