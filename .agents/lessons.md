# Lessons

Each entry is a mistake that this project already made. It gives the symptom you see, the cause, what to do, and where a check now guards against it. Read the entries for your area before you start. When you find a new mistake that someone else could repeat, add an entry, and add a check if one fits.

## Backend

### Changing the user model breaks existing databases

- **Symptom.** `migrate` or `makemigrations --check` fails with `InconsistentMigrationHistory: Migration admin.0001_initial is applied before its dependency accounts.0001_initial`.
- **Cause.** The database was migrated with Django's built-in user model before `AUTH_USER_MODEL` pointed at `accounts.User`. Django cannot swap the user model of a migrated database.
- **Do.** On a development database with no data you need, drop it, create it again, and migrate. [`docs/admin.md`](../docs/admin.md) has the commands. Never change `AUTH_USER_MODEL` again. Add fields to `accounts.User` instead.

### The backend venv picks up the system Python

- **Symptom.** In a fresh worktree, `moon run backend:install` fails with `No matching distribution found for Django==6.1.3`, or `backend/.venv/bin/python --version` prints whatever `python3` the machine has, such as 3.10 or 3.11.
- **Cause.** The install steps ran `python3 -m venv .venv`, so the venv got whatever `python3` the machine had. Django 6.1 needs Python 3.12 or later.
- **Do.** Pin the version in `backend/.python-version` and create the venv with `scripts/backend-venv.sh`, never `python3 -m venv`. **Guard.** The script uses uv to install the pinned Python and recreates a venv on any other version. The moon `install` task and `scripts/check.sh` both call it.

### `pip freeze` leaks development tools into production

- **Symptom.** `requirements.txt` suddenly lists `import-linter` and `grimp`, and the Docker image grows.
- **Cause.** `backend/.venv` holds both runtime packages and the tools from `requirements-dev.txt`. `pip freeze` writes all of them.
- **Do.** Add each new package to `requirements.txt` or `requirements-dev.txt` by hand, pinned with `==`.

### Backend checks need the database

- **Symptom.** `scripts/check.sh` fails in the backend step with a Postgres authentication error, or prints a warning about migration history.
- **Cause.** `makemigrations --check` reads the migration history from the database, and `manage.py test` creates a test database. Both use the credentials in the repo-root `.env`.
- **Do.** Make sure `.env` exists and its Postgres user has `CREATEDB`. In a separate git worktree, link or copy the main checkout's `.env` into the worktree root.

### Django's test client is rejected outside the test runner

- **Symptom.** In `manage.py shell`, `Client().get(...)` returns 400 with `Invalid HTTP_HOST header: 'testserver'`.
- **Cause.** The test runner adds `testserver` to `ALLOWED_HOSTS`. The shell does not.
- **Do.** Use `Client(HTTP_HOST="localhost")` in the shell. Tests need no change.

## Dashboard and website

### shadcn's default theme overrides the design tokens

- **Symptom.** After `shadcn init` or `shadcn add`, the accent turns gray, borders change, or the font becomes Geist.
- **Cause.** shadcn writes a `:root` block with its own `--accent`, `--border`, and `--radius`, which share names with our tokens and have different meanings.
- **Do.** Keep only the `@theme inline` mapping in `dashboard/src/tailwind.css`. Delete any `:root` or `.dark` block and any font import that shadcn adds. Style with mapped classes such as `bg-primary`. **Guard.** `scripts/check-design.sh` fails on a `:root` block or a raw shadcn variable.

### `shadcn add` stops on a question when a component exists

- **Symptom.** `npx shadcn@latest add dialog alert-dialog` hangs at "The file button.tsx already exists. Would you like to overwrite?", and a script or agent that runs it waits until it times out.
- **Cause.** Some components pull in `button`, which this repository already fitted to `DESIGNS.md`. The CLI asks before it overwrites, even with `--yes`.
- **Do.** Answer no from the shell: `yes n | npx shadcn@latest add <name>`. Then check `git diff src/components/ui/` and `src/tailwind.css`. The sonner toaster also installs `next-themes`; point it at `src/hooks/useTheme.ts` and uninstall `next-themes`, as `src/components/ui/sonner.tsx` does.

### A search param that `validateSearch` leaves out still reaches the route

- **Symptom.** After sign-in from `/sign-in?redirect=https://evil.example/`, the browser leaves the dashboard, although the sign-in route's `validateSearch` rejects that value.
- **Cause.** TanStack Router lays each route's validated search over the raw query string. A key that `validateSearch` leaves out keeps its raw value in `search`.
- **Do.** Return every key from `validateSearch`, and set it to `undefined` when the value is not valid, as the sign-in route in `dashboard/src/app/router.tsx` does. **Guard.** The redirect checks in `scripts/e2e/signin.mjs` sign in with three off-origin redirects and expect `/routes`.

### Unlayered CSS beats every Tailwind class

- **Symptom.** A Tailwind class such as `mt-6` has no effect on an `h1` or a `p`.
- **Cause.** A rule outside any `@layer` wins over every layered rule, whatever its specificity. Tailwind's utilities are layered.
- **Do.** Keep every rule in `design.css` inside `@layer base` or `@layer components`. Only the tokens on `:root` stay unlayered.

### The Expo template fails its own typecheck

- **Symptom.** On a fresh clone, `npx tsc --noEmit` in `mobile/` cannot find CSS modules or `global.css`.
- **Cause.** `expo-env.d.ts` declares those types. `expo start` writes the file, and git ignores it.
- **Do.** Run `expo start` once, or create the file with `/// <reference types="expo/types" />`. **Guard.** `scripts/check.sh` creates the file when it is missing.

### A fresh clone cannot start the Vite apps through moon

- **Symptom.** `moon run :dev` fails with `vite: command not found`.
- **Cause.** No step installed `node_modules`.
- **Do.** Nothing. **Guard.** Each Vite app's `install` task in `moon.yml` runs `npm ci` when `package-lock.json` changed.

## Verifying in a browser

### Headless Chrome cannot render a phone-width window

- **Symptom.** A screenshot taken with `--window-size=390,...` shows cut-off text, as if the page were wider than the image.
- **Cause.** Chrome's window is at least 500px wide, so the page lays out at 500px.
- **Do.** Use `scripts/screenshot.mjs`, which sets the width through device emulation.

### Full-page screenshots show blank sections

- **Symptom.** Sections below the first screen are empty in a full-page capture of the website.
- **Cause.** The landing page reveals sections with scroll-driven animations. Sections that were never scrolled into view stay transparent.
- **Do.** Use `scripts/screenshot.mjs`, which turns on `prefers-reduced-motion`. The design turns animations off under that setting.

### Fixed sleeps in a browser test race the server

- **Symptom.** `scripts/e2e-dashboard.sh` fails now and then: the right password shows "The email or password is incorrect.", and the backend log shows two 401s in the same second.
- **Cause.** The test slept a fixed time after the wrong-password submit. When the server answered late, the form was still disabled. Disabled inputs drop out of `FormData`, so the next submit sent `null` for the email and password.
- **Do.** Wait for what the user would see, such as the error box or the sidebar, with the `until` helper in `scripts/e2e/signin.mjs`. Do not add fixed sleeps after a server call.

### A browser test that picks its targets by position breaks when the sample plan changes

- **Symptom.** `scripts/e2e/routes.mjs` fails "the moved stop sits in its new row as an outline" after a planner change, although dragging works by hand. The change bar says "1 stop no longer fits".
- **Cause.** The test dropped a stop on the middle of the first route's row. Once the planner packed that route closer to the end of the shift, no place after the drop had room, so the planner left the stop unassigned, as it should.
- **Do.** Choose drag targets and expected rows from the plan data, such as the route that finishes earliest, not from row order or position. Assert what the dispatcher reads, such as the absence of "no longer fits", so the failure names its cause.

### Chrome keeps writing to its profile after it exits

- **Symptom.** Deleting the temporary Chrome profile fails with `ENOTEMPTY`.
- **Cause.** Chrome's helper processes outlive the main process for a moment.
- **Do.** Close Chrome with the DevTools `Browser.close` command, then treat the profile cleanup as best effort. `scripts/screenshot.mjs` does both.

## Shell

### zsh does not split unquoted variables into words

- **Symptom.** A loop such as `for s in "a b"; do set -- $s; ...` gets empty arguments, and file names come out as `-.png`.
- **Cause.** Interactive shells on macOS run zsh, which does not word-split `$s`. The variable for pipe exit codes is also `pipestatus`, not `PIPESTATUS`.
- **Do.** Put multi-step logic in a script that starts with `#!/usr/bin/env bash`, or pass arguments explicitly.
