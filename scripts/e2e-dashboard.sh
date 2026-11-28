#!/usr/bin/env bash
# End-to-end test of dashboard sign-in against the real Django backend, in Chrome.
#   scripts/e2e-dashboard.sh [screenshot-dir]
# Set COLOR_SCHEME=light or COLOR_SCHEME=dark to take the screenshots in that theme.
# Set API_PORT, DASH_PORT, or CDP_PORT to run beside another copy of this script.
# Creates a throwaway database and user, starts Django and the dashboard on spare ports,
# runs scripts/e2e/signin.mjs and scripts/e2e/tour.mjs, and removes everything it created, even when a step fails.
# Needs: PostgreSQL reachable with the credentials in .env, backend/.venv, dashboard/node_modules, Chrome.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$(mktemp -d)}"
mkdir -p "$out"

[[ -f "$root/.env" ]] && { set -a; . "$root/.env"; set +a; }
export POSTGRES_DB="nextsci_e2e_$$"
email="e2e-dispatcher@example.com"
password="e2e-$$-route-test"
api_port="${API_PORT:-8777}" dash_port="${DASH_PORT:-5199}" cdp_port="${CDP_PORT:-9333}"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
profile="$(mktemp -d)"
pids=()

cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  sleep 1
  PGPASSWORD="${POSTGRES_PASSWORD:-}" dropdb --if-exists -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" "$POSTGRES_DB" 2>/dev/null || true
  rm -rf "$profile"
}
trap cleanup EXIT

for port in $api_port $dash_port $cdp_port; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $port is busy; stop what uses it and retry" >&2; exit 1; fi
done

wait_for() {
  for _ in $(seq 60); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done
  echo "timed out waiting for $1" >&2; return 1
}

echo "== backend on :$api_port with database $POSTGRES_DB"
PGPASSWORD="${POSTGRES_PASSWORD:-}" createdb -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" "$POSTGRES_DB"
cd "$root/backend"
.venv/bin/python manage.py migrate -v0
.venv/bin/python manage.py shell -v0 -c "from django.contrib.auth import get_user_model as g; g().objects.create_user(email='$email', password='$password')"
.venv/bin/python manage.py runserver "$api_port" >"$out/backend.log" 2>&1 &
pids+=($!)

echo "== dashboard on :$dash_port"
cd "$root/dashboard"
# Run the vite binary itself: killing npx would leave vite holding the port after the script exits.
API_PROXY_TARGET="http://localhost:$api_port" node_modules/.bin/vite --port "$dash_port" --strictPort >"$out/dashboard.log" 2>&1 &
pids+=($!)

"$chrome" --headless=new --disable-gpu --remote-debugging-port="$cdp_port" --user-data-dir="$profile" about:blank >/dev/null 2>&1 &
pids+=($!)

wait_for "http://localhost:$api_port/admin/login/"
wait_for "http://localhost:$dash_port/"
wait_for "http://localhost:$cdp_port/json/version"

echo "== sign-in flow"
node "$root/scripts/e2e/signin.mjs" "$cdp_port" "http://localhost:$dash_port/" "$out" "$email" "$password"
echo "== tour of every screen on the mock data"
node "$root/scripts/e2e/tour.mjs" "$cdp_port" "http://localhost:$dash_port/" "$out" "$email" "$password"
echo "== stops: import, address review, and stop CRUD"
node "$root/scripts/e2e/stops.mjs" "$cdp_port" "http://localhost:$dash_port/" "$out" "$email" "$password"
echo "screenshots and logs: $out"
