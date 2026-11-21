#!/usr/bin/env bash
# Keeps the agent docs navigable: every doc in .agents/ is indexed, and every relative link resolves.
set -uo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
python3 - <<'PY'
import re, subprocess, sys
from pathlib import Path

fail = False
def err(msg):
    global fail
    fail = True
    print(f"docs: {msg}", file=sys.stderr)

# Tracked and new files, minus anything gitignored (such as personal notes in .agents/).
tracked = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "*.md"], capture_output=True, text=True, check=True).stdout.split()
docs = [p for p in tracked if not p.startswith(("frontend/node_modules", "dashboard/node_modules", "mobile/node_modules"))]

# 1. Every doc in .agents/ is listed in both indexes.
index = Path(".agents/README.md").read_text()
agents = Path("AGENTS.md").read_text()
for p in sorted(Path(".agents").glob("*.md")):
    if p.name == "README.md" or str(p) not in tracked:
        continue
    if f"({p.name})" not in index:
        err(f".agents/{p.name} is not in the 'Which doc to read' table of .agents/README.md")
    if f".agents/{p.name}" not in agents:
        err(f".agents/{p.name} is not listed under 'Agent docs' in AGENTS.md")

# 2. Every relative link in a tracked markdown file points at a file or folder that exists.
link = re.compile(r"\]\(([^)\s]+)\)")
for doc in docs:
    path = Path(doc)
    text = re.sub(r"```.*?```", "", path.read_text(), flags=re.S)
    for target in link.findall(text):
        if re.match(r"^[a-z]+:", target) or target.startswith("#"):
            continue
        rel = target.split("#", 1)[0]
        if rel and not (path.parent / rel).exists():
            err(f"{doc}: link to {target} does not resolve")

if not fail:
    print("docs checks passed")
sys.exit(1 if fail else 0)
PY
