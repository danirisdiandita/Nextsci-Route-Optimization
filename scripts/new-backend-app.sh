#!/usr/bin/env bash
# Creates backend/apps/<name> in the standard layout and registers it.
#   scripts/new-backend-app.sh <name>     name is snake_case, such as fleet or route_plans
set -euo pipefail
name="${1:-}"
[[ "$name" =~ ^[a-z][a-z0-9_]*$ ]] || { echo "usage: $0 <snake_case_name>" >&2; exit 1; }

backend="$(cd "$(dirname "$0")/../backend" && pwd)"
cd "$backend"
[[ -e "apps/$name" ]] && { echo "apps/$name already exists; nothing changed" >&2; exit 1; }
python=".venv/bin/python"
[[ -x "$python" ]] || { echo "backend/.venv is missing. Run: cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2; exit 1; }

mkdir "apps/$name"
"$python" manage.py startapp --template app_template "$name" "apps/$name"

# Register the app, its URLs, and nothing else. Each edit anchors on a marker comment.
"$python" - "$name" <<'PY'
import re, sys
from pathlib import Path
name = sys.argv[1]

def insert_before(path, marker, line):
    text = Path(path).read_text()
    if marker not in text:
        sys.exit(f"{path}: marker '{marker.strip()}' not found")
    Path(path).write_text(text.replace(marker, line + marker, 1))

insert_before("config/settings/base.py", "    # new-backend-app: apps above\n", f'    "apps.{name}",\n')
insert_before("config/urls.py", "    # new-backend-app: urls above\n",
              f'    path("api/v1/{name.replace("_", "-")}/", include("apps.{name}.api.urls")),\n')
PY

echo "Created backend/apps/$name and registered it in config/settings/base.py and config/urls.py."
echo "Its API is served under /api/v1/${name//_/-}/. Next: add models, then run .venv/bin/python manage.py makemigrations $name"
