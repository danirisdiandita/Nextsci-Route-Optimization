# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## Project

Nextsci Route Optimisation is an open-source route planning and optimisation platform, similar in scope to OptimoRoute. Dispatchers plan routes on the web, the backend solves them, and drivers run them on mobile. It is a monorepo with four independent apps. Each app has its own dependencies and lockfile, and there is no root package manager.

## Repository layout

- `backend/` — Django 6 API on PostgreSQL with PostGIS, through GeoDjango (`config/` is the project package; `config/tests/` checks that PostGIS and pgvector answer queries). Python venv in `backend/.venv`, deps pinned in `requirements.txt`. Settings come from environment variables, loaded from the repo-root `.env` for local runs.
  - `config/settings/` — `base.py` shared, `dev.py` (default, DEBUG on), `prod.py` (DEBUG off, requires `DJANGO_SECRET_KEY`, HTTPS-only). Select with `DJANGO_SETTINGS_MODULE`.
  - `apps/<app>/` — one Django app per domain in a fixed layout (`models.py`, `services.py`, `selectors.py`, `api/`, `tests/`). Create apps with `scripts/new-backend-app.sh <name>`. Layout, import rules, and the planned domain map: `.agents/backend.md`.
  - `.importlinter` — import contracts that `lint-imports` checks; `requirements-dev.txt` adds dev tools on top of `requirements.txt`.
  - `apps/accounts/` — email-login custom `User` (`AUTH_USER_MODEL = "accounts.User"`) and JWT auth.
  - API is versioned under `/api/v1/`. Auth: `POST auth/token/` (email, password → access, refresh), `POST auth/token/refresh/`, `GET auth/me/`. DRF requires a JWT bearer token by default.
- `dashboard/` — Vite + React + TypeScript dispatcher app that self-hosters deploy. Opens on sign-in, has no landing page. Calls the API on its own origin (`/api`); in development Vite proxies `/api` to Django (`API_PROXY_TARGET`, default `http://localhost:8000`). Only sign-in uses the API today: depots, vehicles, drivers, stops, plans, and the agent conversation come from a mock server in `src/api/mock/` that keeps every table in localStorage (`nextsci.mock.v1`). A first visit starts empty and opens the setup checklist; the user menu's **Reset demo data** loads a sample Yogyakarta kitchen and **Start empty** clears it. Every screen has a URL: `/sign-in`, `/today`, `/onboarding`, `/routes` (with `/routes/new`, `/routes/timeline`, `/routes/live`), `/stops` (with `/stops/new`, `/stops/import`, `/stops/import/$importId`, `/stops/review`, `/stops/$orderId`), `/drivers` (with `/drivers/new`, `/drivers/vehicles`, `/drivers/$driverId`), and `/depots` (with `/depots/new`, `/depots/$depotId`). `/` opens `/onboarding` until a plan exists, then `/today`. `src/app/` holds the TanStack Router route tree and its sign-in guards (`router.tsx`) and the signed-in shell (`shell/AppShell.tsx`: sidebar sections in `shell/sections.ts`, header slots, and the **Agent** button that opens the dispatch agent panel). How to add a screen: the Routing section of `.agents/react.md`; how the mock works and how a call moves to `fetch`: its Mock server section. Each domain lives in `src/features/<name>/` (`auth`, `onboarding`, `routes`, `stops`, `drivers`, `depots`, `assistant`): its calls in `api.ts`, its hooks and TanStack Query in `hooks/`, its screens in `components/`. Shared code: domain types in `src/api/types.ts`, shadcn/ui components on Tailwind CSS v4 in `src/components/ui/`, other shared components in `src/components/` (`RouteMap`, `Timeline`, `HeaderSlot`, `ConfirmDialog`, `FormField`, `EmptyState`), shared hooks in `src/hooks/` (data several features read, such as `useDrivers` and `useCurrentPlan`, and `useWorkspaceMutation`; the persisted theme choice is a zustand store in `src/hooks/useTheme.ts`), and query keys in `src/lib/queryKeys.ts`. `npm test` runs the mock server tests in `tests/`. npm. The Vite dev server answers every path with `index.html`. A production static host must do the same for any path that is not a file, or deep links and reloads return 404.
- `frontend/` — Vite + React + TypeScript public project website with the landing page in `src/landing/`. Not part of a self-hosted deployment. npm.
  - `src/pages.ts` lists every page (`/`, `/terms/`, `/privacy/`) with its path and title. `npm run build` prerenders each one: `src/entry-server.tsx` renders `App` for a page, and `scripts/prerender.mjs` writes it into `dist/<path>/index.html`, which `src/main.tsx` then hydrates. To add a page, add it to `pages.ts` and to the `body` table in `src/App.tsx`. Code that runs on import must not touch `window` or `document`, because it also runs in Node at build time. Set `SITE_URL` at build time to add the canonical URL and `sitemap.xml`.
  - `src/landing/legal.ts` holds the terms of service and privacy policy text. Update its `updated` date when you change either, and keep the privacy policy true: it says the website has no analytics or cookies and the software sends no telemetry.
  - `Dockerfile` builds the prerendered site and serves it with nginx (`nginx.conf.template`, listens on `$PORT`, default 8080).
- `.github/workflows/landing-railway.yml` — deploys only `frontend/` to Railway on pushes to `main` that touch it, or by hand. Needs the repository secrets `RAILWAY_TOKEN` (a project token) and `RAILWAY_LANDING_PAGE_SERVICE_ID`.
- `frontend/src/design.css` and `dashboard/src/design.css` — identical copies of the design tokens (each color a `light-dark()` pair), base styles, and shared components. Edit one and copy it to the other; `scripts/check-design.sh` fails if they differ.
- `scripts/check-design.sh` — enforces the UI rules in `.agents/ui.md`; `scripts/check.sh` runs it
- `scripts/check-react.sh` — enforces the React code layout in `.agents/react.md`; `scripts/check.sh` runs it
- `dashboard/AGENTS.md`, `frontend/AGENTS.md` — per-app pointers to the rules below, loaded by agents working inside each app
- `scripts/screenshot.mjs` — full-page screenshot of a running app at an exact width, including widths under 500px
- `scripts/e2e/theme.mjs` — end-to-end test of the System, Light, and Dark theme switch against a running app (dashboard or website)
- `scripts/e2e-dashboard.sh` — end-to-end dashboard test in Chrome against a throwaway database: sign-in, URL routing (deep links, the sign-in redirect, back, reload, not-found), the sidebar, the theme switch, and sign-out, then a tour of every screen on the mock data with a screenshot of each (`COLOR_SCHEME=light|dark` sets the screenshots' theme); then the dispatch agent's first day from a description to the live day; drives `scripts/e2e/signin.mjs`, `scripts/e2e/tour.mjs`, and `scripts/e2e/assistant.mjs`
- `scripts/check-docs.sh` — fails when a doc in `.agents/` is not indexed or a relative markdown link breaks; `scripts/check.sh` runs it
- `mobile/` — Expo (SDK 58) + Expo Router React Native app for drivers. npm. Read `mobile/AGENTS.md` before touching it.
- `compose.yaml` — runs Postgres (built from `db/Dockerfile`), backend, dashboard, and the Expo dev server together
- `pgdata/` — the `router-db` data, bind-mounted by `compose.yaml`. Gitignored, and owned by the container's postgres user, so git and your user cannot read it. Delete it (with `sudo`) to start from an empty database. A `pgdata/` created before PostGIS was added keeps its data but lacks the extension: run `docker compose up -d --build router-db`, then `docker exec router-db psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c 'CREATE EXTENSION IF NOT EXISTS postgis;'`, and the same with `-d template1`.
- `db/Dockerfile` — the `router-db` image: `pgvector/pgvector:pg17` plus the PostGIS 3 package
- `db/init/` — SQL that the `router-db` service runs once when `pgdata/` is empty; enables the `vector` and `postgis` extensions in the app database and in `template1`
- `.env.example` — every config variable; copy to `.env` (gitignored)
- `.moon/workspace.yml`, `backend/moon.yml`, `frontend/moon.yml`, `dashboard/moon.yml` — moon task runner config
- `.prototools` — pins node for proto, which moon puts first on task PATH
- `scripts/check.sh` — installs, typechecks, and builds all four apps; run before declaring work done
- `README.md` — project overview
- `docs/admin.md` — how-to for creating the master admin (Django superuser), signing in to the dashboard, and adding accounts. Update it when account or sign-in behavior changes.
- `AGENTS.md` — this file; the single source of truth for agent instructions
- `CLAUDE.md` — imports this file for Claude Code
- `.agents/` — agent rules, workflow, and lessons; index in `.agents/README.md`

## Agent docs

Detailed guidance lives in `.agents/`. Start with [.agents/README.md](.agents/README.md): it holds the rules for every change, says which doc covers which area, and lists every enforced check. Read the relevant file before working in that area:

- [.agents/workflow.md](.agents/workflow.md) — set up, run the apps, branch and commit, and verify each kind of change. Read it before your first change.
- [.agents/lessons.md](.agents/lessons.md) — mistakes this project already made, with the symptom, the cause, and the fix. Read the section for your area.
- [DESIGNS.md](DESIGNS.md) — design system: colors, type, components, and landing page structure. Read it before any UI work in `dashboard/`, `frontend/`, or `mobile/`.
- [.agents/ui.md](.agents/ui.md) — rules that keep the website and the dashboard on one design, and how to verify UI work. Read it before changing `frontend/src/` or `dashboard/src/`.
- [.agents/backend.md](.agents/backend.md) — Django layout: one app per domain, `api` → `services`/`selectors` → `models`, the domain dependency order, and the planned apps. Read it before changing `backend/`.
- [.agents/react.md](.agents/react.md) — React code layout for the Vite apps: one folder per feature in `src/features/`, custom hooks and TanStack Query only in hook folders, server calls only in API modules, and no imports between features. Read it before writing React code in `dashboard/` or `frontend/`.

## Commands

Verify everything: `./scripts/check.sh`

Run backend (:8000), dashboard (:5174), and website (:5173) together: `moon run :dev`. Each project's `install` task runs first: it creates `backend/.venv` and installs `requirements.txt`, and runs `npm ci` in `dashboard/` and `frontend/` when `package-lock.json` changed. Needs a running PostgreSQL configured in `.env`.

Apply migrations: `moon run backend:migrate`. Create the master admin: `moon run backend:createsuperuser` (installs and migrates first, then prompts for email and password; add `-- --noinput` with `DJANGO_SUPERUSER_EMAIL` and `DJANGO_SUPERUSER_PASSWORD` set to skip the prompts).

Whole stack in Docker: `cp .env.example .env && docker compose up --build`. Ports: backend 8000, dashboard 5174, Metro 8081, Postgres `POSTGRES_HOST_PORT` (default 5432). Set `HOST_LAN_IP` in `.env` so Expo Go on a phone can reach Metro. Services and containers are named `router-db`, `router-backend`, `router-dashboard`, and `router-mobile`. Database only: `docker compose up -d router-db`.

Backend (`cd backend`):
- Setup: install GDAL (`sudo apt install gdal-bin`, or `brew install gdal`), then `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`, then fill the `POSTGRES_*` values in the repo-root `.env` for a running Postgres with PostGIS and pgvector
- Migrate: `.venv/bin/python manage.py migrate`
- Run: `.venv/bin/python manage.py runserver`
- Check: `.venv/bin/python manage.py check`
- Import rules: `.venv/bin/lint-imports` (needs `pip install -r requirements-dev.txt`)
- New app: `scripts/new-backend-app.sh <name>` (from the repository root)
- Test: `.venv/bin/python manage.py test` (creates a throwaway test DB, so the Postgres user needs CREATEDB)
- Add a dependency: `.venv/bin/pip install <pkg>`, then add `<pkg>==<version>` by hand to `requirements.txt` (runtime) or `requirements-dev.txt` (tools). Do not `pip freeze` into `requirements.txt`: the venv also holds the dev tools.

Dashboard (`cd dashboard`):
- Setup: `npm install`
- Run: `npm run dev` (http://localhost:5174; needs the backend on :8000 for sign-in)
- Lint: `npm run lint` (oxlint)
- Build + typecheck: `npm run build`
- Test the mock server: `npm test`

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

The rules for every change are in `.agents/README.md`. In short:

- Keep changes small and focused; don't add unrelated refactors.
- Add or update tests alongside behaviour changes.
- Don't commit secrets, credentials, or large data files.
- Document new commands and structure in this file when you add them.
