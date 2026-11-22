# Agent docs

This folder holds the rules for working in this repository. [`AGENTS.md`](../AGENTS.md) at the root gives the layout and the commands. The files here give the rules for each area, the way to verify a change, and the mistakes that this project already made once.

Read `AGENTS.md` first. Then read this file, and the doc for each area that your change touches.

## Rules for every change

1. **Read the doc for the area before you edit it.** The table below names it.
2. **Branch from `dev`, and open pull requests against `dev`.** `main` holds releases only.
3. **Run `./scripts/check.sh` before you call the work done.** It installs, builds, and tests every app, and it runs every enforced rule below.
4. **Verify on the real thing.** A passing build does not prove that a screen or an endpoint works. [`workflow.md`](workflow.md) lists the check for each kind of change.
5. **Turn a rule into a check.** When you write the same instruction a second time, add it to a script in `scripts/` instead, and list it in the table of enforced rules. Prose rules drift. Checks do not.
6. **Keep the docs true in the same commit.** When you change a folder, a command, or a rule, update `AGENTS.md` and the doc here. `scripts/check-docs.sh` fails when a link breaks or a doc in this folder is not listed.
7. **Report what you verified and how.** Say which checks ran. Say plainly what you did not test.
8. **Never commit secrets.** Local credentials live in the gitignored `.env`.

## Which doc to read

| You change | Read |
| --- | --- |
| Anything | [`workflow.md`](workflow.md) and [`lessons.md`](lessons.md) |
| `backend/` | [`backend.md`](backend.md) |
| `dashboard/src/` or `frontend/src/` | [`ui.md`](ui.md), [`react.md`](react.md), and [`DESIGNS.md`](../DESIGNS.md) |
| `mobile/` | [`mobile/AGENTS.md`](../mobile/AGENTS.md) and [`DESIGNS.md`](../DESIGNS.md) |
| Accounts or sign-in | [`backend.md`](backend.md) and [`docs/admin.md`](../docs/admin.md) |

## Enforced rules

`scripts/check.sh` runs every check in this table. Run one by itself when you work in its area.

| Rule | Check | Defined in |
| --- | --- | --- |
| `design.css` and `favicon.svg` are identical in the website and the dashboard | `scripts/check-design.sh` | [`ui.md`](ui.md) |
| Colors come from design tokens, never raw hex | `scripts/check-design.sh` | [`ui.md`](ui.md) |
| Apps never restyle a shared component | `scripts/check-design.sh` | [`ui.md`](ui.md) |
| Dashboard code never reads a shadcn theme variable, and `tailwind.css` has no `:root` block | `scripts/check-design.sh` | [`ui.md`](ui.md) |
| Custom hooks and TanStack Query only in hook folders, `fetch` only in API modules, features never import each other, shared code never imports a feature | `scripts/check-react.sh` | [`react.md`](react.md) |
| Inside a Django app, `api` → `services`/`selectors` → `models` | `lint-imports` in `backend/` | [`backend.md`](backend.md) |
| Django apps import only apps below them in the domain order | `lint-imports` in `backend/` | [`backend.md`](backend.md) |
| Every doc here is indexed, and every relative link resolves | `scripts/check-docs.sh` | this file |

## Add a doc to this folder

1. Write the doc. Use one topic per file and a name that says the topic, such as `testing.md`.
2. Add a row for it to "Which doc to read" in this file.
3. Add a line for it under "Agent docs" in `AGENTS.md`.
4. Run `./scripts/check-docs.sh`.
