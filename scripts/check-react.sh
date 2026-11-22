#!/usr/bin/env bash
# Enforces the code layout rules in .agents/react.md for the Vite apps.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
fail=0
err() { echo "react: $*" >&2; fail=1; }
src() { grep -rnE "$1" "$app/src" --include='*.ts' --include='*.tsx'; }

# Hook folders: src/hooks/ for shared hooks, src/features/<name>/hooks/ for one feature's hooks.
hooks='(hooks|features/[^/]+/hooks)/'

for app in dashboard frontend; do
  # 1. TanStack Query is used only inside hooks. main.tsx may create the client and provider.
  bad=$(src "from ['\"]@tanstack/react-query['\"]" | grep -vE "^$app/src/($hooks|main\.tsx:)")
  [[ -z "$bad" ]] || err "TanStack Query imported outside a hook folder. Wrap the query or mutation in a hook in $app/src/hooks/ or $app/src/features/<name>/hooks/:
$bad"

  # 2. Custom hooks are defined only in hook folders.
  #    src/components/ui/ is shadcn code copied into the repo, so its internal hooks may stay there.
  bad=$(src "^(export )?(default )?(async )?(function|const|let) use[A-Z]" | grep -vE "^$app/src/($hooks|components/ui/)")
  [[ -z "$bad" ]] || err "custom hook defined outside a hook folder. Move it to $app/src/hooks/<hookName>.ts, or to $app/src/features/<name>/hooks/<hookName>.ts if one feature owns it:
$bad"

  # 3. Each file in a hook folder holds one hook named after the file.
  while IFS= read -r f; do
    name=$(basename "$f"); name=${name%.*}
    [[ "$name" == use[A-Z]* ]] || { err "$f: files in hooks/ are named after their hook, such as useRoutes.ts"; continue; }
    grep -qE "^export (default )?function $name\b" "$f" || err "$f: export a function named $name"
  done < <(find "$app/src" -type f \( -name '*.ts' -o -name '*.tsx' \) | grep -E "^$app/src/$hooks")

  # 4. Network calls live in API modules. Hooks and components call those functions.
  bad=$(src "\bfetch\(" | grep -vE "^$app/src/(api/|features/[^/]+/(api\.ts:|api/))")
  [[ -z "$bad" ]] || err "fetch() outside an API module. Add a function in $app/src/features/<name>/api.ts, or in $app/src/api/ if every feature needs it, and call it from a hook:
$bad"
done

[[ $fail -eq 0 ]] && echo "react checks passed"
exit $fail
