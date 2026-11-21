# backend

Before you change Django code, read [`../.agents/backend.md`](../.agents/backend.md). It defines the folder layout, the import rules, and the planned domain apps.

- Create a new app with `scripts/new-backend-app.sh <name>` from the repository root, not with `startapp`.
- Run `.venv/bin/lint-imports` in this folder to check the import rules. `../scripts/check.sh` runs it too.
