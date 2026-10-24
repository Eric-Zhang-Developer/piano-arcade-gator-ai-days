#!/usr/bin/env bash
# Put new migrations on the live Supabase project, safely. Run from the repo root:
#   supabase/push.sh            test, show what would run, ask, apply, then check the live project
#   supabase/push.sh --status   only list which migrations the live project has
# Needs SUPABASE_DB_URL in web/.env.local (server only, never NEXT_PUBLIC_): see supabase/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."
CLI="npx -y supabase@2.122.0"

DB_URL="$(grep -E '^SUPABASE_DB_URL=' web/.env.local 2>/dev/null | head -1 | cut -d= -f2- | sed -E "s/^[\"']|[\"']$//g" || true)"
if [[ -z "$DB_URL" ]]; then
  echo "SUPABASE_DB_URL is missing from web/.env.local."
  echo "Supabase dashboard > Connect > Session pooler: copy the URI, put your database password in it, and add"
  echo "  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>.pooler.supabase.com:5432/postgres"
  exit 1
fi

if [[ "${1:-}" == "--status" ]]; then
  $CLI migration list --db-url "$DB_URL"
  exit 0
fi

echo "== 1/4 every migration on a throwaway Postgres"
[[ -d supabase/tests/node_modules ]] || npm --prefix supabase/tests ci --silent
node supabase/tests/migrations.mjs

echo "== 2/4 what the live project would run"
$CLI migration list --db-url "$DB_URL"
$CLI db push --dry-run --db-url "$DB_URL"

read -r -p "== 3/4 apply these to the live project? [y/N] " answer
[[ "$answer" == "y" || "$answer" == "Y" ]] || { echo "nothing applied"; exit 0; }
$CLI db push --db-url "$DB_URL"

echo "== 4/4 the live project, end to end"
node supabase/tests/live-smoke.mjs
