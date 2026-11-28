#!/usr/bin/env bash
# Creates backend/.venv on the Python version pinned in backend/.python-version.
# A venv on any other version is recreated, so a stale or system-Python venv cannot linger.
set -euo pipefail
cd "$(dirname "$0")/../backend"
command -v uv >/dev/null || { echo "uv is missing. Install it: curl -LsSf https://astral.sh/uv/install.sh | sh" >&2; exit 1; }
want="$(cat .python-version)"
have="$(.venv/bin/python -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null || true)"
# --seed installs pip, which the install steps call as .venv/bin/pip.
[ "$have" = "$want" ] || uv venv --seed --clear --quiet .venv
