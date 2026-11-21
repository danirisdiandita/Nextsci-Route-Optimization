# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working in this repository.

## Project

Nextsci Route Optimisation is an open-source route planning and optimisation platform, similar in scope to OptimoRoute. Dispatchers plan routes on the web, the backend solves them, and drivers run them on mobile. It is a monorepo with three independent apps. Each app has its own dependencies and lockfile, and there is no root package manager.

## Repository layout

- `backend/` — Django 6 API (`config/` is the project package). Python venv in `backend/.venv`, deps pinned in `requirements.txt`.
- `frontend/` — Vite + React + TypeScript web app for dispatchers. npm.
- `mobile/` — Expo (SDK 58) + Expo Router React Native app for drivers. npm. Read `mobile/AGENTS.md` before touching it.
- `scripts/check.sh` — installs, typechecks, and builds all three apps; run before declaring work done
- `README.md` — project overview
- `AGENTS.md` — this file; the single source of truth for agent instructions
- `CLAUDE.md` — imports this file for Claude Code
- `.agents/` — detailed agent docs referenced below

## Agent docs

Detailed guidance lives in `.agents/`. Read the relevant file before working in that area:

<!-- Add entries as files are created, e.g.
- [Architecture](.agents/architecture.md) — system design and module boundaries
- [Testing](.agents/testing.md) — how to write and run tests
-->

## Commands

Verify everything: `./scripts/check.sh`

Backend (`cd backend`):
- Setup: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- Run: `.venv/bin/python manage.py runserver`
- Check: `.venv/bin/python manage.py check`
- Add a dependency: `.venv/bin/pip install <pkg> && .venv/bin/pip freeze > requirements.txt`

Frontend (`cd frontend`):
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
