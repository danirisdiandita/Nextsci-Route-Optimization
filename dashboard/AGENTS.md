# dashboard

Before you change `src/`, read the repository rules for the Vite apps:

- [`../.agents/react.md`](../.agents/react.md): custom hooks live in `src/hooks/`, TanStack Query appears only in those hooks, and only `src/api/` calls `fetch`.
- [`../.agents/ui.md`](../.agents/ui.md) and [`../DESIGNS.md`](../DESIGNS.md): the shared design.

Run `../scripts/check.sh` before you finish. It runs `check-react.sh` and `check-design.sh`.
