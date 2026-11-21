#!/usr/bin/env bash
# Verifies every app in the monorepo installs, typechecks, and builds.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

echo "== backend"
cd "$root/backend"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run

echo "== frontend"
cd "$root/frontend"
npm ci --no-fund --no-audit
npm run lint
npm run build

echo "== dashboard"
cd "$root/dashboard"
npm ci --no-fund --no-audit
npm run lint
npm run build
cmp "$root/frontend/src/design.css" "$root/dashboard/src/design.css" \
  || { echo "frontend/src/design.css and dashboard/src/design.css differ; keep them identical" >&2; exit 1; }

echo "== mobile"
cd "$root/mobile"
npm ci --no-fund --no-audit
# expo start normally writes this gitignored file; typecheck needs it on a fresh clone.
[ -f expo-env.d.ts ] || printf '/// <reference types="expo/types" />\n' > expo-env.d.ts
npx tsc --noEmit
CI=1 npx expo export --platform web --output-dir "$(mktemp -d)"

echo "all checks passed"
