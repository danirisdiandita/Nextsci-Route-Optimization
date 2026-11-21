#!/usr/bin/env bash
# Enforces the design rules in .agents/ui.md for frontend/ and dashboard/.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
fail=0
err() { echo "design: $*" >&2; fail=1; }

# 1. Shared files are byte-identical in both apps.
for f in src/design.css public/favicon.svg; do
  cmp -s "frontend/$f" "dashboard/$f" ||
    err "frontend/$f and dashboard/$f differ. Edit one, then copy it: cp frontend/$f dashboard/$f"
done

# 2. Colors come from tokens. Only design.css defines raw hex values.
hex=$(grep -rnE '#[0-9a-fA-F]{3}([0-9a-fA-F]{3}([0-9a-fA-F]{2})?)?\b' frontend/src dashboard/src \
  --include='*.css' --include='*.ts' --include='*.tsx' | grep -v '/design\.css:')
[[ -z "$hex" ]] || err "raw hex colors outside design.css. Use a token from DESIGNS.md, or add one to design.css:
$hex"

# 3. Apps never restyle a shared component. They may position it through a parent selector.
shared=$(grep -oE '^\.[a-z][a-z0-9-]*' frontend/src/design.css | sort -u | sed 's/^\.//' | paste -sd'|' -)
redefined=$(grep -rnE "^\.(${shared})([ :,.{]|$)" frontend/src dashboard/src --include='*.css' | grep -v '/design\.css:')
[[ -z "$redefined" ]] || err "app styles redefine shared components from design.css. Change design.css instead, or scope with a parent selector:
$redefined"

[[ $fail -eq 0 ]] && echo "design checks passed"
exit $fail
