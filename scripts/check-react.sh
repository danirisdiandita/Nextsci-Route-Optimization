#!/usr/bin/env bash
# Enforces the code layout rules in .agents/react.md for the Vite apps.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
fail=0
err() { echo "react: $*" >&2; fail=1; }
src() { grep -rnE "$1" "$app/src" --include='*.ts' --include='*.tsx'; }

# Every @/ or relative import in src/, as "<file>:<line>: imports <path>", with the path resolved to $app/src/...
imports() {
  grep -rnoE "(from|import) ['\"][^'\"]+['\"]|import\(['\"][^'\"]+['\"]\)" "$app/src" --include='*.ts' --include='*.tsx' |
    python3 -c '
import os, re, sys
app = sys.argv[1]
for line in sys.stdin:
    f, n, rest = line.rstrip("\n").split(":", 2)
    spec = re.search(r"[\x27\"]([^\x27\"]+)[\x27\"]", rest).group(1)
    if spec.startswith("@/"):
        print(f"{f}:{n}: imports {app}/src/{spec[2:]}")
    elif spec.startswith("."):
        print(f"{f}:{n}: imports {os.path.normpath(os.path.join(os.path.dirname(f), spec))}")
' "$app"
}

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

  # 5. A feature imports only its own files and shared code, never another feature.
  #    src/app/ is where features meet, so it may import anything.
  imp=$(imports)
  bad=$(awk -F': imports ' -v p="$app/src/features/" 'index($1, p) == 1 && index($2, p) == 1 {
    split(substr($1, length(p) + 1), from, "/"); split(substr($2, length(p) + 1), to, "/")
    if (from[1] != to[1]) print }' <<<"$imp")
  [[ -z "$bad" ]] || err "a feature imports another feature. Move the shared code to $app/src/components/, hooks/, or lib/, or connect the two features in $app/src/app/:
$bad"

  # 6. Shared code never imports from a feature or from the app shell.
  bad=$(grep -E "^$app/src/(components|hooks|lib|api)/[^:]*:[0-9]+: imports $app/src/(features|app)(/|$)" <<<"$imp")
  [[ -z "$bad" ]] || err "shared code in components/, hooks/, lib/, or api/ imports from features/ or app/. Pass the value in as a prop or argument, or move the file into the feature that uses it:
$bad"
done

[[ $fail -eq 0 ]] && echo "react checks passed"
exit $fail
