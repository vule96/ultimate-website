# Slice 16 — Production Edge (local-prep)

**Ngày:** 2026-07-19
**Phạm vi đợt này:** phần **làm + test được ngay KHÔNG cần VPS**. Cutover live (firewall, chạy 24/7 trên domain) để khi có VPS + domain.
**Mục tiêu:** stack không còn publish port trần; 1 reverse-proxy Caddy nhận 80/443, auto-TLS; DB backup `pg_dump→R2` script + cron.

## 1. Caddy reverse-proxy + auto-TLS
- **`Dockerfile.caddy`** (gốc repo): `xcaddy` build Caddy 2 + plugin `caddy-dns/cloudflare` → cho phép **TLS DNS-01** (xin cert không cần inbound :80, hợp Cloudflare proxy). Base `caddy:2`.
- **`Caddyfile`** (env-driven, 3 site block):
  - `{$WEB_DOMAIN}` → `reverse_proxy web:3000`
  - `{$API_DOMAIN}` → `reverse_proxy core:8080`
  - `{$ADMIN_DOMAIN}` → `reverse_proxy admin:8080`
  - Global: `tls {$ACME_EMAIL}` + `acme_dns cloudflare {$CLOUDFLARE_API_TOKEN}` (DNS-01); `encode gzip zstd`; security headers (HSTS, X-Content-Type-Options, Referrer-Policy) — bổ trợ, không đè CSP app.
  - **Local test**: biến `{$TLS_MODE:internal}` → `tls internal` (self-signed) khi test máy; prod set qua env.
- **`docker-compose.edge.yml`** (override chồng lên prod): thêm service `caddy` (publish `80:80`,`443:443`, mount `Caddyfile` + volume `caddy_data`/`caddy_config` giữ cert, env domains + CF token, `networks: ultimate_net`); **reset publish port** của `core`/`web`/`admin` (`ports: !reset []`) → chỉ Caddy ra ngoài. postgres/redis vốn đã không publish.

## 2. DB backup pg_dump → R2
- **`scripts/backup-db.sh`**: `pg_dump` (qua `docker compose exec -T postgres`) → `gzip` → tên `blog-YYYYmmdd-HHMMSS.sql.gz` → upload R2 (`aws s3 cp --endpoint-url $STORAGE_ENDPOINT s3://$BACKUP_BUCKET/...`) → prune giữ `BACKUP_KEEP` bản mới nhất (list+xoá cũ). Fail-fast (`set -euo pipefail`), log rõ. Dùng lại STORAGE_ACCESS_KEY/SECRET/ENDPOINT; **bucket riêng** `BACKUP_BUCKET` (mặc định `ultimate-backups`).
- **Cron**: doc hướng dẫn host crontab (`0 3 * * * cd /srv/app && ./scripts/backup-db.sh >> /var/log/backup.log 2>&1`). Không dựng cron-container đợt này (VPS host cron gọn hơn).
- **Test ngay**: chạy `scripts/backup-db.sh` với postgres local → verify file `.sql.gz` xuất hiện trong R2 (bucket backup) + prune đúng.

## 3. Env + docs
- **`.env.prod.example`** thêm khối: `WEB_DOMAIN`/`API_DOMAIN`/`ADMIN_DOMAIN`, `ACME_EMAIL`, `CLOUDFLARE_API_TOKEN`, `TLS_MODE`, `BACKUP_BUCKET`, `BACKUP_KEEP`.
- **README / `docs/cicd.html`**: mục "Production edge" — thứ tự dựng (DNS Cloudflare → token → `up -d` với `-f prod -f edge`), firewall ufw (80/443/22) là **bước VPS** (doc, chưa chạy), backup cron.

## 4. Nợ đã biết (không chặn)
- **`NEXT_PUBLIC_API_URL` build-arg web** — client (beacon/reader/subscribe) gọi thẳng core; sau Caddy phải trỏ `API_DOMAIN`, cần bake lúc build image web (nợ Slice 14). Doc rõ: khi cutover, build web với `NEXT_PUBLIC_API_URL=https://api.domain`.
- OAuth redirect prod: `GOOGLE_REDIRECT_URL`/`READER_REDIRECT_URL` phải là `https://api.domain/...` + đăng ký Console.
- Firewall + chạy 24/7 = bước VPS (Slice 17 CD nối tiếp).

## 5. Verify (đợt local-prep)
- `docker compose -f docker-compose.prod.yml -f docker-compose.edge.yml config` merge đúng (caddy có, app hết publish port).
- Build `Dockerfile.caddy` OK (xcaddy + cloudflare plugin).
- Local: chạy stack + edge với `TLS_MODE=internal` + domains trỏ `127.0.0.1` (hosts file / `--add-host`) → `https://web.localtest` route ra web (self-signed). Ít nhất verify Caddy route HTTP nội bộ (curl qua caddy → web/core) OK.
- Backup script chạy thật → R2 có file + prune.
