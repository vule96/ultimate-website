#!/usr/bin/env bash
# Backup Postgres → Cloudflare R2 (dùng lại STORAGE_* creds, bucket riêng BACKUP_BUCKET).
# Chạy từ gốc repo. Cron VPS:
#   0 3 * * * cd /srv/app && ./scripts/backup-db.sh >> /var/log/mach-backup.log 2>&1
# Yêu cầu: docker (aws-cli chạy qua container amazon/aws-cli — không cần cài host).
set -euo pipefail

cd "$(dirname "$0")/.."

# Đọc .env.prod AN TOÀN — KHÔNG `source` (value có thể chứa ký tự shell như '<').
# Biến đã có trong môi trường được ưu tiên (tiện test/override).
getenv() { [ -f .env.prod ] && grep -E "^$1=" .env.prod | tail -1 | cut -d= -f2- || true; }
STORAGE_ENDPOINT="${STORAGE_ENDPOINT:-$(getenv STORAGE_ENDPOINT)}"
STORAGE_ACCESS_KEY="${STORAGE_ACCESS_KEY:-$(getenv STORAGE_ACCESS_KEY)}"
STORAGE_SECRET_KEY="${STORAGE_SECRET_KEY:-$(getenv STORAGE_SECRET_KEY)}"
STORAGE_REGION="${STORAGE_REGION:-$(getenv STORAGE_REGION)}"
BUCKET="${BACKUP_BUCKET:-$(getenv BACKUP_BUCKET)}"; BUCKET="${BUCKET:-ultimate-backups}"
KEEP="${BACKUP_KEEP:-$(getenv BACKUP_KEEP)}"; KEEP="${KEEP:-14}"
PGUSER="${POSTGRES_USER:-$(getenv POSTGRES_USER)}"; PGUSER="${PGUSER:-blog}"
PGDB="${POSTGRES_DB:-$(getenv POSTGRES_DB)}"; PGDB="${PGDB:-blog}"

: "${STORAGE_ENDPOINT:?thiếu STORAGE_ENDPOINT}"
: "${STORAGE_ACCESS_KEY:?thiếu STORAGE_ACCESS_KEY}"
: "${STORAGE_SECRET_KEY:?thiếu STORAGE_SECRET_KEY}"
COMPOSE=(docker compose --env-file .env.prod -f docker-compose.prod.yml)

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
ts="$(date +%Y%m%d-%H%M%S)"
file="blog-${ts}.sql.gz"

echo "[backup] pg_dump ${PGDB} → ${file}"
"${COMPOSE[@]}" exec -T postgres pg_dump -U "$PGUSER" "$PGDB" | gzip -9 > "$tmp/$file"
echo "[backup] dump $(du -h "$tmp/$file" | cut -f1)"

# aws-cli qua container (R2 = S3-compatible + --endpoint-url).
r2() {
  docker run --rm \
    -e AWS_ACCESS_KEY_ID="$STORAGE_ACCESS_KEY" \
    -e AWS_SECRET_ACCESS_KEY="$STORAGE_SECRET_KEY" \
    -e AWS_DEFAULT_REGION="${STORAGE_REGION:-auto}" \
    -v "$tmp:/data" \
    amazon/aws-cli --endpoint-url "$STORAGE_ENDPOINT" "$@"
}

r2 s3 cp "/data/$file" "s3://$BUCKET/$file"
echo "[backup] uploaded s3://$BUCKET/$file"

# Prune: giữ KEEP bản mới nhất (tên có timestamp → sort tăng dần, xoá đầu danh sách).
mapfile -t all < <(r2 s3 ls "s3://$BUCKET/" | awk '{print $4}' | grep -E '^blog-.*\.sql\.gz$' | sort)
n=${#all[@]}
if (( n > KEEP )); then
  for old in "${all[@]:0:n-KEEP}"; do
    echo "[backup] prune $old"
    r2 s3 rm "s3://$BUCKET/$old"
  done
fi
echo "[backup] done (tổng ${n}, giữ ${KEEP})"
