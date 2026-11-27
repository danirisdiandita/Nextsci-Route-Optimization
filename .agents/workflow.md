# Make and verify a change

This guide takes a change from a clean checkout to a merged commit on `dev`.

## Set up once

1. Copy the config file: `cp .env.example .env`. Set the `POSTGRES_*` values for a running PostgreSQL 17 server with the PostGIS and pgvector extensions. `docker compose up -d router-db` starts one. The user needs the `CREATEDB` permission, because the tests create a throwaway database.
2. Install the GDAL, GEOS, and PROJ system libraries, which Django's GIS support loads at runtime. On Debian or Ubuntu run `sudo apt install gdal-bin`. On macOS run `brew install gdal`. With GDAL older than 3.9, `manage.py check` prints warning `gis.W001`. The warning does not fail a check, and the backend Docker image ships GDAL 3.10.
3. Install moon from [moonrepo.dev](https://moonrepo.dev), or set up each app by hand with the commands in `AGENTS.md`.
4. Create the master admin: `moon run backend:createsuperuser`. It creates `backend/.venv`, applies migrations, then asks for an email and password. [`docs/admin.md`](../docs/admin.md) has the other ways and how to add more accounts.

## Run the apps

Run `moon run :dev` from the repository root. It installs what each app needs, then starts all three:

| App | Address |
| --- | --- |
| Django API server and admin | http://localhost:8000 |
| Dashboard | http://localhost:5174 |
| Project website | http://localhost:5173 |

The dashboard sends `/api` requests to the API server. To use another address, set `API_PROXY_TARGET` before you start it.

## Branches and commits

Every feature, bug fix, and chore is built in its own git worktree, then merged into `dev` as soon as it passes the checks. Separate worktrees let several tasks run in parallel without touching each other's files.

1. **Start from the latest `dev`.** In the main checkout, run `git fetch origin` and then `git switch dev && git pull --ff-only origin dev`. Never branch from a stale `dev`.
2. **Create a worktree for the task.** Name the branch `feat/<short-name>`, `fix/<short-name>`, or `chore/<short-name>`, and put the worktree next to the repository, not inside it:

	```bash
	git worktree add -b feat/<short-name> ../Nextsci-Route-Optimization-worktrees/feat-<short-name> origin/dev
	```

	A new worktree has no `.env`, `backend/.venv`, or `node_modules`. Copy `.env` from the main checkout, then run `moon run :install` inside the worktree. If two worktrees run dev servers at the same time, give each its own ports.
3. **Work and commit in the worktree only.** Run one worktree per task. Never edit the same task in two worktrees, and never commit a task's work in the main checkout.
4. **Merge into `dev` automatically when the checks pass.** Push the branch, open a pull request against `dev`, and merge it right away without waiting for review:

	```bash
	git push -u origin feat/<short-name>
	gh pr create --base dev --fill
	gh pr merge --merge --delete-branch
	```

5. **Resolve conflicts yourself.** If the branch conflicts with `dev`, run `git fetch origin && git merge origin/dev` in the worktree, fix every conflict so that both sides' intent survives, run `./scripts/check.sh` again, push, and merge. Never discard the other side's changes to make a conflict go away. If you cannot tell what one side meant, stop and ask.
6. **Clean up and resync.** Remove the worktree with `git worktree remove ../Nextsci-Route-Optimization-worktrees/feat-<short-name>`, then pull `dev` again in the main checkout so it matches `origin/dev`.

Commits:

- Make small commits. Each commit builds and passes the checks by itself, so a reviewer can read the branch one commit at a time.
- Write the subject as a command in sentence case, at most about 70 characters: `Add vehicle capacity to the fleet API`. Use the body to say why, not what the diff shows.

## Verify the change

Pick every row that matches what you changed. The build passing is never enough by itself.

| You changed | Run | It proves |
| --- | --- | --- |
| Anything | `./scripts/check.sh` | Every app installs, typechecks, builds, and passes the enforced rules and the backend tests |
| Django models, services, or endpoints | `cd backend && .venv/bin/python manage.py test` | The API behaves as the tests describe. Add a test in the app's `tests/` folder for new behavior |
| Django imports between modules or apps | `cd backend && .venv/bin/lint-imports` | The layering and the domain order still hold |
| Dashboard sign-in, sessions, `src/features/auth/api.ts`, the routes in `src/app/router.tsx`, or the sidebar shell | `./scripts/e2e-dashboard.sh <dir>`, once with `COLOR_SCHEME=light` and once with `COLOR_SCHEME=dark` | Sign-in, wrong-password errors, reloads, token refresh, URL routing (deep links, the sign-in redirect and its same-origin check, back, reload, not-found), the sidebar (collapse, persistence, sections, phone sheet), the theme switch in the shell header, and sign-out work in Chrome against the real API server. The screenshots in `<dir>` show the signed-in screens in that theme. Open them and look |
| Any screen in the dashboard or the website | `node scripts/screenshot.mjs <url> <file.png> 1280` and again with `390` | The screen renders at desktop and phone width without sideways scrolling. Open the images and look at them |
| `design.css` | Screenshots of both apps | A shared change shows up in both apps |
| `compose.yaml` or a `Dockerfile` | `docker compose up --build` on a machine with Docker | The stack starts. If you could not run Docker, say so in the pull request |

`scripts/e2e-dashboard.sh` creates a throwaway database and user, uses ports 8777, 5199, and 9333, and removes everything when it exits.

## Report the result

In the pull request or your final message:

- List the checks you ran and their results.
- Name anything you did not verify, and why.
- Mark numbers as measured, and estimates as estimates.

## Write docs

Docs here are read by people and by agents. Follow these rules:

- Lead with what the reader can do. Put commands in code blocks.
- Use sentence-case headings, short sentences, and one idea per sentence.
- Write instructions as commands: "Run", "Add", "Open".
- Describe what exists. Mark planned work as planned.
- Use real file names, commands, and flags, not descriptions of them.
- Add no emojis and no filler.
