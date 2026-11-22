# dashboard

Before you change `src/`, read the repository rules for the Vite apps:

- [`../.agents/react.md`](../.agents/react.md): each domain lives in `src/features/<name>/` (`api.ts`, `hooks/`, `components/`) and `src/app/` wires them together. Custom hooks live only in hook folders, TanStack Query appears only in those hooks, only API modules call `fetch`, and a feature never imports another feature.
- [`../.agents/ui.md`](../.agents/ui.md) and [`../DESIGNS.md`](../DESIGNS.md): the shared design. Build the interface from shadcn/ui components in `src/components/ui/` (`npx shadcn@latest add <name>`), fitted to `DESIGNS.md`, and style with the token-mapped classes in `src/tailwind.css`.

Run `../scripts/check.sh` before you finish. It runs `check-react.sh` and `check-design.sh`.
