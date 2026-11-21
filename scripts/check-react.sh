#!/usr/bin/env bash
# Enforces the code layout rules in .agents/react.md for the Vite apps.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
fail=0
err() { echo "react: $*" >&2; fail=1; }
src() { grep -rnE "$1" "$app/src" --include='*.ts' --include='*.tsx'; }

for app in dashboard frontend; do
  # 1. TanStack Query is used only inside hooks. main.tsx may create the client and provider.
  bad=$(src "from ['\"]@tanstack/react-query['\"]" | grep -vE "^$app/src/(hooks/|main\.tsx:)")
  [[ -z "$bad" ]] || err "TanStack Query imported outside $app/src/hooks/. Wrap the query or mutation in a hook there:
$bad"

  # 2. Custom hooks are defined only in src/hooks/.
  #    src/components/ui/ is shadcn code copied into the repo, so its internal hooks may stay there.
  bad=$(src "^(export )?(default )?(async )?(function|const|let) use[A-Z]" | grep -vE "^$app/src/(hooks|components/ui)/")
  [[ -z "$bad" ]] || err "custom hook defined outside $app/src/hooks/. Move it to $app/src/hooks/<hookName>.ts:
$bad"

  # 3. Each file in src/hooks/ holds one hook named after the file, or is the query key registry.
  if [[ -d "$app/src/hooks" ]]; then
    while IFS= read -r f; do
      name=$(basename "$f"); name=${name%.*}
      [[ "$name" == queryKeys ]] && continue
      [[ "$name" == use[A-Z]* ]] || { err "$f: files in hooks/ are named after their hook, such as useRoutes.ts"; continue; }
      grep -qE "^export (default )?function $name\b" "$f" || err "$f: export a function named $name"
    done < <(find "$app/src/hooks" -type f \( -name '*.ts' -o -name '*.tsx' \))
  fi

  # 4. Network calls live in src/api/. Hooks and components call those functions.
  bad=$(src "\bfetch\(" | grep -v "^$app/src/api/")
  [[ -z "$bad" ]] || err "fetch() outside $app/src/api/. Add a function in $app/src/api/ and call it from a hook:
$bad"
done

[[ $fail -eq 0 ]] && echo "react checks passed"
exit $fail
