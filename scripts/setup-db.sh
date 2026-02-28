#!/bin/bash
# Run all Ghostly migrations + seed against Supabase
# Usage: ./scripts/setup-db.sh "postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"

set -e

DB_URL="${1:?Usage: $0 <database-url>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Running Ghostly database migrations..."

for f in "$PROJECT_DIR"/supabase/migrations/*.sql; do
  echo "  → $(basename "$f")"
  psql "$DB_URL" -f "$f" -v ON_ERROR_STOP=1
done

echo ""
echo "Running seed data..."
psql "$DB_URL" -f "$PROJECT_DIR/supabase/seed.sql" -v ON_ERROR_STOP=1

echo ""
echo "Done! All migrations and seed data applied."
