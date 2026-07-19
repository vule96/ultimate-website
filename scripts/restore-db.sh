#!/usr/bin/env bash
# Restore Postgres từ backup (R2 hoặc file local) → nạp vào 1 database đích.
# Dùng:
#   ./scripts/restore-db.sh                      # bản mới nhất trên R2 → DB 'blog' (cần RESTORE_CONFIRM=yes)
#   ./scripts/restore-db.sh blog-YYYYmmdd-HHMMSS.sql.gz   # 1 bản cụ thể trên R2
#   ./scripts/restore-db.sh --file /path/backup.sql.gz    # file local (không cần R2)
#   RESTORE_DB=blog_restore_drill ./scripts/restore-db.sh --file ...   # drill vào DB scratch
#
# AN TOÀN: restore = DROP + tạo lại DB đích rồi nạp. Vào DB KHÁC 'blog_restore_drill'
# bắt buộc RESTORE_CONFIRM=yes (tránh xoá nhầm prod).
set -euo pipefail
cd "$(dirname "$0")/.."

getenv() { [ -f .env.prod ] && grep -E "^$1=" .env.prod | tail -1 | cut -d= -f2- || true; }
STORAGE_ENDPOINT="${STORAGE_ENDPOINT:-$(getenv STORAGE_ENDPOINT)}"
STORAGE_ACCESS_KEY="${STORAGE_ACCESS_KEY:-$(getenv STORAGE_ACCESS_KEY)}"
STORAGE_SECRET_KEY="${STORAGE_SECRET_KEY:-$(getenv STORAGE_SECRET_KEY)}"
STORAGE_REGION="${STORAGE_REGION:-$(getenv STORAGE_REGION)}"
BUCKET="${BACKUP_BUCKET:-$(getenv BACKUP_BUCKET)}"; BUCKET="${BUCKET:-ultimate-backups}"
PGUSER="${POSTGRES_USER:-$(getenv POSTGRES_USER)}"; PGUSER="${PGUSER:-blog}"
RESTORE_DB="${RESTORE_DB:-blog}"
COMPOSE=(docker compose --env-file .env.prod -f docker-compose.prod.yml)

if [ "$RESTORE_DB" != "blog_restore_drill" ] && [ "${RESTORE_CONFIRM:-}" != "yes" ]; then
  echo "[restore] '$RESTORE_DB' sẽ bị DROP + nạp lại. Đặt RESTORE_CONFIRM=yes để tiếp tục." >&2
  exit 1
fi

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

if [ "${1:-}" = "--file" ]; then
  [ -n "${2:-}" ] || { echo "[restore] thiếu đường dẫn file" >&2; exit 1; }
  cp "$2" "$tmp/backup.sql.gz"
  echo "[restore] từ file local: $2"
else
  : "${STORAGE_ENDPOINT:?thiếu STORAGE_ENDPOINT}"
  r2() {
    docker run --rm \
      -e AWS_ACCESS_KEY_ID="$STORAGE_ACCESS_KEY" \
      -e AWS_SECRET_ACCESS_KEY="$STORAGE_SECRET_KEY" \
      -e AWS_DEFAULT_REGION="${STORAGE_REGION:-auto}" \
      -v "$tmp:/data" \
      amazon/aws-cli --endpoint-url "$STORAGE_ENDPOINT" "$@"
  }
  KEY="${1:-}"
  if [ -z "$KEY" ]; then
    KEY="$(r2 s3 ls "s3://$BUCKET/" | awk '{print $4}' | grep -E '^blog-.*\.sql\.gz$' | sort | tail -1)"
    [ -n "$KEY" ] || { echo "[restore] R2 bucket rỗng" >&2; exit 1; }
    echo "[restore] bản mới nhất: $KEY"
  fi
  r2 s3 cp "s3://$BUCKET/$KEY" "/data/backup.sql.gz"
fi

echo "[restore] recreate DB '$RESTORE_DB'"
"${COMPOSE[@]}" exec -T postgres dropdb -U "$PGUSER" --if-exists "$RESTORE_DB"
"${COMPOSE[@]}" exec -T postgres createdb -U "$PGUSER" "$RESTORE_DB"

echo "[restore] nạp dump → '$RESTORE_DB'"
gunzip -c "$tmp/backup.sql.gz" | "${COMPOSE[@]}" exec -T postgres psql -U "$PGUSER" -d "$RESTORE_DB" -v ON_ERROR_STOP=1 -q

echo "[restore] xong → '$RESTORE_DB'"
