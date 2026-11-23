#!/usr/bin/env bash
set -euo pipefail

# Owner-operated logical backup. Do not hardcode secrets.
# Required env: DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)
# Optional env: BACKUP_DIR (default ./backups), BACKUP_PREFIX (default varsity)

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-varsity}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/${BACKUP_PREFIX}-${TIMESTAMP}.dump"

if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --format=custom --no-owner --no-privileges --file="$OUT" "$DATABASE_URL"
else
  pg_dump --format=custom --no-owner --no-privileges --file="$OUT"
fi

sha256sum "$OUT" > "$OUT.sha256"
echo "Backup written: $OUT"
