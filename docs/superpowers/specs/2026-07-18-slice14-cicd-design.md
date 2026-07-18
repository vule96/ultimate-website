# Slice 14 — CI/CD (GitHub Actions + GHCR) — Design

**Ngày:** 2026-07-18
**Trạng thái:** Approved (brainstorm) → implement
**Bối cảnh:** Phase 1 hoàn tất (Slice 1→13). Bước kế tiếp đã chốt: CI/CD + deploy VPS. Repo GitHub `vule96/ultimate-website`, chưa có workflow nào.

## 1. Mục tiêu & phạm vi

Chưa có VPS → triển khai **2 tầng, CD dormant**:

1. **CI** (kích hoạt ngay): chạy test + lint + typecheck + build làm **gate merge PR**; khi merge vào `main` thì build + push Docker image lên GHCR.
2. **CD** (viết sẵn, chạy thủ công `workflow_dispatch`; trigger auto để comment-out): SSH lên VPS → migrate → pull image → `docker compose up`. Kích hoạt (điền secrets + bỏ comment) khi đã có server.

Nhánh tích hợp: **`main`**.

### Quyết định đã chốt (brainstorm)
- VPS: **chưa có** → CI trước, CD dormant.
- Registry: **GHCR** (`ghcr.io`), auth bằng `GITHUB_TOKEN`, không cần secret ngoài.
- Trigger: **PR + push branch → test**; **merge `main` → push image** tag `latest` + `sha-<short>`.
- Monorepo: **lọc theo path** (`dorny/paths-filter`) — chỉ chạy job của phần thay đổi.

## 2. File tạo ra

```
.github/workflows/ci.yml          # PR + push: test/lint/build (path-filtered)
.github/workflows/release.yml     # push main: build + push 3 image GHCR
.github/workflows/deploy.yml      # DORMANT: workflow_dispatch → SSH deploy VPS
docker-compose.deploy.yml         # override: image: ghcr.io/... thay cho build:
```

## 3. CI — `ci.yml`

**Trigger:** `pull_request` (mọi nhánh đích) + `push` (mọi nhánh — để chạy test cả khi push thẳng).

**Concurrency:** hủy run cũ cùng ref (`group: ci-${{ github.ref }}`, `cancel-in-progress: true`).

### Job `changes` (gate path)
- `dorny/paths-filter@v3` → outputs:
  - `core`: `services/core/**`
  - `web`: `apps/web/**`, `packages/**`, `pnpm-lock.yaml`, `package.json`, `turbo.json`
  - `admin`: `apps/admin/**`, `packages/**`, `pnpm-lock.yaml`, `package.json`, `turbo.json`
- Đổi `packages/**` hoặc lockfile → bật cả `web` + `admin` (chúng phụ thuộc `@ultimate/ui` + `@ultimate/types`).

### Job `core` (`if: needs.changes.outputs.core == 'true'`)
- `runs-on: ubuntu-latest`, `defaults.run.working-directory: services/core`.
- **Service container** `pgvector/pgvector:pg16`:
  - env `POSTGRES_USER=blog POSTGRES_PASSWORD=blog POSTGRES_DB=blog`
  - healthcheck `pg_isready`, port `5432:5432`.
  - `blog_test` tạo ở bước riêng: `psql ... -c 'CREATE DATABASE blog_test;'` (service container KHÔNG chạy `docker/postgres-init`, phải tạo tay).
- `actions/setup-go@v5` với `go-version: 1.25.1`, cache module bật sẵn.
- Bước:
  1. `test -z "$(gofmt -l .)"` — fail nếu có file chưa format.
  2. `go vet ./...`
  3. `go build ./...`
  4. `TEST_DATABASE_URL=postgres://blog:blog@localhost:5432/blog_test?sslmode=disable go test ./...`

### Job `web` (`if: needs.changes.outputs.web == 'true'`)
- `pnpm/action-setup@v4` version `11.10.0` + `actions/setup-node@v4` node 20, `cache: pnpm`.
- `pnpm install --frozen-lockfile`.
- `pnpm turbo run lint test build --filter=@ultimate/web...`
  - build web chạy được không cần API nhờ `BUILD_WITHOUT_API=1` (đặt ở env job).

### Job `admin` (`if: needs.changes.outputs.admin == 'true'`)
- Cùng setup pnpm/node.
- `pnpm turbo run lint test build --filter=@ultimate/admin...`
  - `admin` `lint` = `tsc --noEmit`, `build` = `tsc --noEmit && vite build` → thỏa quy ước **đồng bộ admin bắt buộc** (typecheck + build).

> **CI phải xanh mới cho merge** — bật branch protection trên `main` (thao tác GitHub UI, note ở §7).

## 4. Release — `release.yml`

**Trigger:** `push` vào `main` (chỉ build+push khi đã vào nhánh tích hợp). CI và release chạy song song trên `main`; giữ tách file cho rõ ràng (đơn giản hơn `workflow_run`).

**Permissions:** `contents: read`, `packages: write`.

- Login GHCR: `docker/login-action@v3` user `${{ github.actor }}`, pass `${{ secrets.GITHUB_TOKEN }}`.
- `docker/setup-buildx-action@v3`.
- Matrix 3 image, mỗi cái `docker/build-push-action@v6`:

| image | context | dockerfile | build-args |
|---|---|---|---|
| core | `services/core` | (default) | `GIT_SHA=${{ github.sha }}` |
| web | `.` | `apps/web/Dockerfile` | `NEXT_PUBLIC_MEDIA_HOST=${{ vars.NEXT_PUBLIC_MEDIA_HOST }}` |
| admin | `.` | `apps/admin/Dockerfile` | `VITE_API_URL=${{ vars.ADMIN_API_URL }}` |

- Tags: `ghcr.io/vule96/ultimate-website/<name>:latest` + `:sha-${{ github.sha short }}` (dùng `docker/metadata-action@v5`).
- Cache: `cache-from/to: type=gha`.
- **Build-arg public URL** (`web`/`admin` nướng vào bundle lúc build) lấy từ **GitHub repo Variables** (`vars.*`). Chưa có domain → để trống/placeholder; điền khi biết URL prod rồi push lại `main` để rebuild image.

## 5. Deploy — `deploy.yml` (DORMANT)

**Trigger:** chỉ `workflow_dispatch` (input `tag`, mặc định `latest`). Khối `push`/tag auto để **comment sẵn** — bỏ comment khi sẵn sàng.

**Secrets cần (điền khi có VPS):** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key), và (nếu package GHCR để private) `GHCR_PAT`.

**Các bước (SSH tới VPS, `appleboy/ssh-action@v1` hoặc `ssh` thuần):**
1. `docker login ghcr.io` (dùng `GITHUB_TOKEN` không dùng được ngoài Actions runner → cần `GHCR_PAT` khi package private; public thì bỏ qua login).
2. **Migrate DB** — one-shot container Atlas (an toàn hơn nhúng vào entrypoint core, tránh race khi nhiều replica):
   ```
   docker run --rm --network ultimate_net \
     -v $PWD/services/core/migrations:/migrations \
     arigaio/atlas:latest migrate apply \
     --dir file:///migrations \
     --url "$DATABASE_URL"
   ```
3. `docker compose -f docker-compose.prod.yml -f docker-compose.deploy.yml pull`
4. `docker compose -f docker-compose.prod.yml -f docker-compose.deploy.yml up -d`
5. Healthcheck: `curl -fsS http://localhost:8080/healthz` (retry vài lần).

### `docker-compose.deploy.yml` (override)
- Bỏ `build:`, thay `image: ghcr.io/vule96/ultimate-website/<name>:${TAG:-latest}` cho `core`, `web`, `admin`.
- Dùng chồng lên `docker-compose.prod.yml` (giữ postgres/redis/env/network của prod file).

## 6. Verify

- `actionlint` (hoặc `pnpm dlx` / Docker `rhysd/actionlint`) trên 3 workflow → cú pháp + expression hợp lệ.
- YAML parse sạch.
- Không thể chạy Actions thật ở local; xác nhận CI thật sau khi push nhánh (PR đầu tiên) — note ở verify E2E.

## 7. Nợ / lưu ý (không chặn Slice 14)

- **web thiếu `NEXT_PUBLIC_API_URL`** (beacon ViewTracker client-side) trong Dockerfile + prod compose. Thêm build-arg này khi cấu hình domain prod. → backlog.
- **Branch protection** `main` (require CI pass) là thao tác GitHub UI, không nằm trong repo file — note để bật tay.
- **GHCR package visibility**: mặc định private; nếu để public thì VPS pull không cần `GHCR_PAT`. Quyết định khi deploy.
- CD chưa verify live (chưa có VPS) — đây là nợ có chủ đích, dormant cho tới khi dựng server.
- Migration rollback / zero-downtime deploy: chưa làm (Phase sau); hiện `up -d` recreate container, chấp nhận downtime ngắn cho blog cá nhân.

## 8. Nhận xét chuyên gia (0.1% DevOps)

Verify: actionlint sạch cả 3 workflow; `docker compose config` merge override đúng (`build:` bị `!reset`, 3 service trỏ image GHCR).

**Còn thiếu / rủi ro trước production:**
- **Release có thể push image dù test fail.** `ci.yml` và `release.yml` chạy song song trên `main` — image `latest` có thể bị overwrite bởi commit có test đỏ. Chấp nhận được vì merge `main` phải qua PR (đã CI xanh) + branch protection; nhưng push thẳng `main` sẽ lách. Muốn chặt hơn: dùng `workflow_run` (release chỉ chạy sau CI success) — đánh đổi độ trễ + phức tạp. Note để cân nhắc khi có cộng tác viên.
- **Image `web`/`admin` là environment-specific** (public URL nướng lúc build). `latest` build từ `vars.*` rỗng → chỉ dùng verify, KHÔNG deploy được thẳng cho tới khi điền `NEXT_PUBLIC_MEDIA_HOST` + `ADMIN_API_URL` (và thiếu `NEXT_PUBLIC_API_URL` — §7). Tức "một image chạy mọi env" KHÔNG đúng cho FE static; mỗi domain cần rebuild.
- **Không có scan.** Chưa có `govulncheck`, `pnpm audit`, hay Trivy image scan. Rẻ để thêm, nên thêm trước khi mở public.
- **Không cache Go/pnpm store cross-run tối ưu.** `setup-go`/`cache: pnpm` đã cache cơ bản; buildx dùng `type=gha` — ổn cho quy mô này.
- **CD chưa test live** (chưa VPS) — dormant có chủ đích. Migrate qua one-shot Atlas là đúng hướng (idempotent, tách khỏi core entrypoint), nhưng chưa chứng minh end-to-end; atlas.sum integrity + `--dir` phải khớp format Atlas versioned.
- **Downtime khi `up -d` recreate.** Blog cá nhân chấp nhận; nếu cần zero-downtime sau này: blue-green hoặc `--scale` rolling + healthcheck gate.
- **Secret trên VPS**: `.env.prod` để trên server (không qua Actions) là lựa chọn đúng (Actions không chạm secret prod DB). Chỉ SSH key nằm ở GitHub Secrets.

**Ưu tiên kế tiếp:** (1) bật branch protection `main`; (2) thêm `govulncheck` + Trivy; (3) khi có domain → điền `vars.*` + thêm `NEXT_PUBLIC_API_URL`, verify CD live.
