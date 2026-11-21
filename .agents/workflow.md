# Make and verify a change

This guide takes a change from a clean checkout to a merged commit on `dev`.

## Set up once

1. Copy the config file: `cp .env.example .env`. Set the `POSTGRES_*` values for a running PostgreSQL 17 server. The user needs the `CREATEDB` permission, because the tests create a throwaway database.
2. Install moon from [moonrepo.dev](https://moonrepo.dev), or set up each app by hand with the commands in `AGENTS.md`.
3. Migrate the database: `cd backend && .venv/bin/python manage.py migrate`. `moon run :dev` creates `backend/.venv` the first time it runs.
4. Create an account to sign in with. [`docs/admin.md`](../docs/admin.md) has the steps.

## Run the apps

Run `moon run :dev` from the repository root. It installs what each app needs, then starts all three:

| App | Address |
| --- | --- |
| Django API server and admin | http://localhost:8000 |
| Dashboard | http://localhost:5174 |
| Project website | http://localhost:5173 |

The dashboard sends `/api` requests to the API server. To use another address, set `API_PROXY_TARGET` before you start it.

## Branches and commits

- Create a branch from `dev` and name it `feat/<short-name>` or `fix/<short-name>`.
- Make small commits. Each commit builds and passes the checks by itself, so a reviewer can read the branch one commit at a time.
- Write the subject as a command in sentence case, at most about 70 characters: `Add vehicle capacity to the fleet API`. Use the body to say why, not what the diff shows.
- Open the pull request against `dev`.

## Verify the change

Pick every row that matches what you changed. The build passing is never enough by itself.

| You changed | Run | It proves |
| --- | --- | --- |
| Anything | `./scripts/check.sh` | Every app installs, typechecks, builds, and passes the enforced rules and the backend tests |
| Django models, services, or endpoints | `cd backend && .venv/bin/python manage.py test` | The API behaves as the tests describe. Add a test in the app's `tests/` folder for new behavior |
| Django imports between modules or apps | `cd backend && .venv/bin/lint-imports` | The layering and the domain order still hold |
| Dashboard sign-in, sessions, or `src/api/auth.ts` | `./scripts/e2e-dashboard.sh` | Sign-in, wrong-password errors, reloads, token refresh, and sign-out work in Chrome against the real API server |
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
