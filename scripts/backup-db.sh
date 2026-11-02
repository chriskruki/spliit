#!/usr/bin/env bash
# Usage: SOURCE_DB_URL=... [TARGET_DB_URL=...] scripts/backup-db.sh
set -euo pipefail

: "${SOURCE_DB_URL:?set SOURCE_DB_URL to the source direct (non-pooled) connection string}"

dir="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$dir"
file="spliit-$(date +%Y%m%d-%H%M%S).dump"

pg() { docker run --rm --network "${DOCKER_NETWORK:-bridge}" -v "$dir:/backups" postgres:17 "$@"; }

# Only the app's tables live in public; Supabase's auth/storage schemas are skipped.
pg pg_dump "$SOURCE_DB_URL" --schema=public --no-owner --no-acl -Fc -f "/backups/$file"
echo "Backup written to backups/$file"

[ -z "${TARGET_DB_URL:-}" ] && exit 0

# Skip the dump's DROP/CREATE SCHEMA public: the target already has it and may hold other tables.
pg sh -c 'pg_restore -l "$1" | grep -v " SCHEMA - public " > /tmp/toc &&
  pg_restore --clean --if-exists --no-owner --no-acl -L /tmp/toc -d "$2" "$1"' \
  _ "/backups/$file" "$TARGET_DB_URL"
echo "Restored into target database"
