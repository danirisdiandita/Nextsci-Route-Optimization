# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## Project

Nextsci Route Optimisation is an open-source route planning and optimisation platform, similar in scope to OptimoRoute. Dispatchers plan routes on the web, the backend solves them, and drivers run them on mobile. It is a monorepo with four independent apps. Each app has its own dependencies and lockfile, and there is no root package manager.

## Repository layout

- `backend/` — Django 6 API on PostgreSQL (`config/` is the project package). Python venv in `backend/.venv`, deps pinned in `requirements.txt`. Settings come from environment variables, loaded from the repo-root `.env` for local runs.
- `dashboard/` — Vite + React + TypeScript dispatcher app that self-hosters deploy. Opens on sign-in, has no landing page. Calls the API on its own origin (`/api`); in development Vite proxies `/api` to Django (`API_PROXY_TARGET`, default `http://localhost:8000`). Server calls in `src/api/`, custom hooks and TanStack Query in `src/hooks/`, shadcn/ui components on Tailwind CSS v4 in `src/components/ui/`. npm.
- `frontend/` — Vite + React + TypeScript public project website with the landing page in `src/landing/`. Not part of a self-hosted deployment. npm.
- `frontend/src/design.css` and `dashboard/src/design.css` — identical copies of the design tokens, base styles, and shared components. Edit one and copy it to the other; `scripts/check-design.sh` fails if they differ.
- `scripts/check-design.sh` — enforces the UI rules in `.agents/ui.md`; `scripts/check.sh` runs it
- `scripts/check-react.sh` — enforces the React code layout in `.agents/react.md`; `scripts/check.sh` runs it
- `dashboard/AGENTS.md`, `frontend/AGENTS.md` — per-app pointers to the rules below, loaded by agents working inside each app
- `scripts/screenshot.mjs` — full-page screenshot of a running app at an exact width, including widths under 500px
- `mobile/` — Expo (SDK 58) + Expo Router React Native app for drivers. npm. Read `mobile/AGENTS.md` before touching it.
- `compose.yaml` — runs Postgres, backend, dashboard, and the Expo dev server together
- `.env.example` — every config variable; copy to `.env` (gitignored)
- `.moon/workspace.yml`, `backend/moon.yml`, `frontend/moon.yml`, `dashboard/moon.yml` — moon task runner config
- `.prototools` — pins node for proto, which moon puts first on task PATH
- `scripts/check.sh` — installs, typechecks, and builds all four apps; run before declaring work done
- `README.md` — project overview
- `AGENTS.md` — this file; the single source of truth for agent instructions
- `CLAUDE.md` — imports this file for Claude Code
- `.agents/` — detailed agent docs referenced below

## Agent docs

Detailed guidance lives in `.agents/`. Read the relevant file before working in that area:

- [DESIGNS.md](DESIGNS.md) — design system: colors, type, components, and landing page structure. Read it before any UI work in `dashboard/`, `frontend/`, or `mobile/`.
- [.agents/ui.md](.agents/ui.md) — rules that keep the website and the dashboard on one design, and how to verify UI work. Read it before changing `frontend/src/` or `dashboard/src/`.
- [.agents/react.md](.agents/react.md) — React code layout for the Vite apps: custom hooks in `src/hooks/`, TanStack Query only inside those hooks, server calls in `src/api/`. Read it before writing React code in `dashboard/` or `frontend/`.

## Commands

Verify everything: `./scripts/check.sh`

Run backend, dashboard, and website together: `moon run :dev` (installs backend deps into `backend/.venv` first; `dashboard/node_modules` and `frontend/node_modules` must be set up)

Whole stack in Docker: `cp .env.example .env && docker compose up --build`. Ports: backend 8000, dashboard 5174, Metro 8081, Postgres `POSTGRES_HOST_PORT` (default 5432). Set `HOST_LAN_IP` in `.env` so Expo Go on a phone can reach Metro.

Backend (`cd backend`):
- Setup: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`, then fill the `POSTGRES_*` values in the repo-root `.env` for a running Postgres
- Migrate: `.venv/bin/python manage.py migrate`
- Run: `.venv/bin/python manage.py runserver`
- Check: `.venv/bin/python manage.py check`
- Add a dependency: `.venv/bin/pip install <pkg> && .venv/bin/pip freeze > requirements.txt`

Dashboard (`cd dashboard`):
- Setup: `npm install`
- Run: `npm run dev` (http://localhost:5174; needs the backend on :8000)
- Lint: `npm run lint` (oxlint)
- Build + typecheck: `npm run build`

Frontend website (`cd frontend`):
- Setup: `npm install`
- Run: `npm run dev`
- Lint: `npm run lint` (oxlint)
- Build + typecheck: `npm run build`

Mobile (`cd mobile`):
- Setup: `npm install`
- Run: `npx expo start`
- Typecheck: `npx tsc --noEmit`
- Add a dependency: `npx expo install <pkg>` (never plain `npm install`)

## Conventions

- Keep changes small and focused; don't add unrelated refactors.
- Add or update tests alongside behaviour changes.
- Don't commit secrets, credentials, or large data files.
- Document new commands and structure in this file when you add them.
