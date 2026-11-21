# dashboard

Before you change `src/`, read the repository rules for the Vite apps:

- [`../.agents/react.md`](../.agents/react.md): custom hooks live in `src/hooks/`, TanStack Query appears only in those hooks, and only `src/api/` calls `fetch`.
- [`../.agents/ui.md`](../.agents/ui.md) and [`../DESIGNS.md`](../DESIGNS.md): the shared design. Build the interface from shadcn/ui components in `src/components/ui/` (`npx shadcn@latest add <name>`), fitted to `DESIGNS.md`, and style with the token-mapped classes in `src/tailwind.css`.

Run `../scripts/check.sh` before you finish. It runs `check-react.sh` and `check-design.sh`.
