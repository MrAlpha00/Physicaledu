#!/usr/bin/env bash
set -euo pipefail

# Owner-operated restore into an approved target database. TEST IN SCRATCH FIRST.
# Usage: ./scripts/restore-database.sh /path/to/backup.dump
# Required env: DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/backup.dump" >&2
  exit 1
fi

DUMP="$1"
if [[ ! -f "$DUMP" ]]; then
  echo "Backup file not found: $DUMP" >&2
  exit 1
fi

if [[ -f "$DUMP.sha256" ]]; then
  sha256sum -c "$DUMP.sha256"
fi

echo "Restoring $DUMP to target database. Ensure this is the intended approved target."
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DUMP"
else
  pg_restore --clean --if-exists --no-owner --no-privileges "$DUMP"
fi

echo "Restore completed. Run smoke checks and verify RLS/RPCs."
