#!/usr/bin/env bash
# ============================================================
# CREAMEE — Database migration runner
# Cách dùng:
#   bash migrations/run.sh
# Cần biến môi trường (hoặc đặt trong ./.env):
#   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
# ============================================================
set -euo pipefail

# Nếu chưa có MYSQL_USER, thử load từ .env tại cwd
if [ -z "${MYSQL_USER:-}" ] && [ -f .env ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source .env
  set +o allexport
fi

: "${MYSQL_HOST:=127.0.0.1}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_DATABASE:=creamee}"
: "${MYSQL_USER:?MYSQL_USER chưa được set (kiểm tra .env hoặc biến môi trường)}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD chưa được set}"

# Dùng MYSQL_PWD để password không lộ trong `ps`
export MYSQL_PWD="$MYSQL_PASSWORD"
MYSQL_CMD=(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE")

# Bảng theo dõi migration đã apply
"${MYSQL_CMD[@]}" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
SQL

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
applied=0
skipped=0

shopt -s nullglob
for f in "$SCRIPT_DIR"/*.sql; do
  name=$(basename "$f")
  exists=$("${MYSQL_CMD[@]}" -N -B -e \
    "SELECT 1 FROM schema_migrations WHERE filename='$name' LIMIT 1")
  if [ -z "$exists" ]; then
    echo "  → Apply: $name"
    "${MYSQL_CMD[@]}" < "$f"
    "${MYSQL_CMD[@]}" -e \
      "INSERT INTO schema_migrations(filename) VALUES('$name')"
    applied=$((applied + 1))
  else
    echo "  ✓ Skip:  $name (đã apply)"
    skipped=$((skipped + 1))
  fi
done

echo "Migrations xong — mới: $applied, bỏ qua: $skipped"
